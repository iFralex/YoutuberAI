"use server"

import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { z } from "zod";

import { clientConfig, serverConfig } from "../../auth-config";
import { generateStructuredScript } from "@/lib/vertex-ai";

const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_REFERENCE_CHARACTERS = 650_000;

const generationSchema = z.object({
    channelId: z.string().min(10).max(100),
    theme: z.string().min(2).max(50),
    description: z.string().min(20).max(600),
    minutesNumber: z.coerce.number().int().min(2).max(20),
    videosCount: z.coerce.number().int().min(5).max(50),
    sources: z.array(z.string().min(1)).min(1).max(4),
});

const scriptSchema = z.object({
    title: z.string().min(1),
    text: z.string().min(1),
    description: z.string().min(1),
    keywords: z.array(z.string().min(1)).min(1),
});

async function requireAuthenticatedUser() {
    const tokens = await getTokens(cookies(), {
        apiKey: clientConfig.apiKey,
        cookieName: serverConfig.cookieName,
        cookieSignatureKeys: serverConfig.cookieSignatureKeys,
        serviceAccount: serverConfig.serviceAccount,
    });

    if (!tokens?.decodedToken?.user_id) {
        const error = new Error("Authentication required.");
        error.code = "UNAUTHENTICATED";
        throw error;
    }

    return tokens.decodedToken.user_id;
}

function actionError(error, fallbackCode, fallbackMessage) {
    if (error?.code === "UNAUTHENTICATED") {
        return { ok: false, error: { code: error.code, message: error.message } };
    }

    if (error instanceof z.ZodError) {
        return {
            ok: false,
            error: {
                code: "INVALID_INPUT",
                message: error.issues[0]?.message || "Invalid generation input.",
            },
        };
    }

    console.error(fallbackCode, {
        name: error?.name,
        message: error?.message,
    });
    return { ok: false, error: { code: fallbackCode, message: fallbackMessage } };
}

function limitReferenceContext(value) {
    if (value.length <= MAX_REFERENCE_CHARACTERS) return value;
    return value.slice(0, MAX_REFERENCE_CHARACTERS) +
        "\n\n[Reference context truncated to fit the model input limit.]";
}

async function retrieveTranscripts(videoIds) {
    let parsedTranscripts = []
    const YT_INITIAL_PLAYER_RESPONSE_RE = /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/;
    for (let videoId of videoIds) {
        try {
            let response = await fetch("https://www.youtube.com/watch?v=" + videoId)
            if (!response.ok) continue

            const body = await response.text()
            const playerResponse = body.match(YT_INITIAL_PLAYER_RESPONSE_RE)
            if (!playerResponse) continue

            const player = JSON.parse(playerResponse[1])
            if (Number.parseInt(player.videoDetails?.lengthSeconds || "0", 10) < 150) {
                continue
            }

            const tracks = [
                ...(player.captions?.playerCaptionsTracklistRenderer?.captionTracks || []),
            ].sort(compareTracks)
            if (!tracks.length) continue

            response = await fetch(tracks[0].baseUrl + "&fmt=json3")
            if (!response.ok) continue

            const transcript = await response.json()
            const parsedTranscript = (transcript.events || [])
                .filter((event) => event.segs)
                .map((event) => event.segs
                    .map((segment) => segment.utf8)
                    .join(" ")
                    .replace(/[\u200B-\u200D\uFEFF]/g, ""))
                .filter(Boolean)

            if (!parsedTranscript.length) continue

            parsedTranscripts.push({
                transcript: parsedTranscript,
                data: {
                    title: player.videoDetails?.title || "Untitled video",
                    description: player.videoDetails?.shortDescription || "",
                    keywords: player.videoDetails?.keywords || [],
                },
            })
        } catch (error) {
            console.warn("Unable to retrieve captions", {
                videoId,
                message: error?.message,
            })
        }
    }
    return parsedTranscripts
}

function compareTracks(track1, track2) {
    const langCode1 = track1.languageCode;
    const langCode2 = track2.languageCode;

    if (langCode1 === 'en' && langCode2 !== 'en') {
        return -1; // English comes first
    } else if (langCode1 !== 'en' && langCode2 === 'en') {
        return 1; // English comes first
    } else if (track1.kind !== 'asr' && track2.kind === 'asr') {
        return -1; // Non-ASR comes first
    } else if (track1.kind === 'asr' && track2.kind !== 'asr') {
        return 1; // Non-ASR comes first
    }

    return 0; // Preserve order if both have same priority
}


const getVideosIds = async (channelId, videosCount) => {
    const params = new URLSearchParams({
        key: process.env.YOUTUBE_API_KEY || "",
        channelId,
        part: "id",
        order: "date",
        maxResults: String(videosCount),
        type: "video",
    })
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params)
    if (!response.ok) {
        return {
            error: {
                code: response.status,
                message: "Failed to get video IDs: " + response.statusText,
            },
        }
    }

    const data = await response.json()
    return (data.items || []).map((video) => video.id?.videoId).filter(Boolean)
}

const getRawTranscripts = async (channelId, videosCount) => {
    try {
        const videoIds = await getVideosIds(channelId, videosCount)
        if (!Array.isArray(videoIds) || !videoIds.length)
            return videoIds

        return await retrieveTranscripts(videoIds)
    } catch (e) {
        console.error("TRANSCRIPT_RETRIEVAL_FAILED", { message: e?.message })
        return { message: "Failed to retrieve channel transcripts." }
    }
}

export const getChannelData = async channelId => {
    try {
        let data = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&id=" + channelId + "&fields=items%2Fsnippet%2Fthumbnails%2Fmedium,items%2Fsnippet%2Ftitle&key=" + process.env.YOUTUBE_API_KEY)
        if (!data.ok)
            return { error: { code: data.status, message: "Failled to get channel data: " + data.statusText } }
        data = await data.json()
        data = data.items[0].snippet
        return { id: channelId, youtuber: data.title, image: data.thumbnails.medium }
    } catch (e) {
        return { error: { code: "1", message: "Something wrong: " + e.message } }
    }
}

export const getChannelIdFromUsername = async username => {
    try {
        let data = await fetch("https://youtube.googleapis.com/youtube/v3/search?part=id&maxResults=1&fields=items(id(channelId))&q=" + username + "&type=channel&key=" + process.env.YOUTUBE_API_KEY)
        console.log(data)
        if (!data.ok)
            return { error: { code: data.status, message: "Failled to get channel id: " + data.statusText } }
        data = await data.json()
        console.log(data.items.forEach(i => console.log(i)), username)
        return data.items[0].id.channelId
    } catch (e) {
        return { error: { code: "1", message: "Something wrong: " + e.message } }
    }
}

export async function getGeneratedTranscript(input) {
    try {
        await requireAuthenticatedUser();
        const {
            channelId,
            theme,
            description,
            minutesNumber,
            videosCount,
            sources,
        } = generationSchema.parse(input);

        for (const source of sources) {
            if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
                return {
                    ok: false,
                    error: {
                        code: "SOURCE_TOO_LARGE",
                        message: "Each source must be no larger than 1 MB.",
                    },
                };
            }
        }

        const rawTranscripts = await getRawTranscripts(channelId, videosCount);
        if (!Array.isArray(rawTranscripts) || rawTranscripts.length === 0) {
            return {
                ok: false,
                error: {
                    code: "TRANSCRIPTS_UNAVAILABLE",
                    message: rawTranscripts?.error?.message ||
                        rawTranscripts?.message ||
                        "No usable captions were found for this channel.",
                },
            };
        }

        const videoDetails = rawTranscripts.map(video => {
            const {
                title = "Untitled video",
                keywords = [],
                description: videoDescription = "",
            } = video.data || {};
            const transcriptText = Array.isArray(video.transcript)
                ? video.transcript.join(" ")
                : "";

            return `### Video: ${title}\nKeywords: ${keywords.join(", ")}\nDescription: ${videoDescription}\nTranscript: ${transcriptText}`;
        }).join("\n\n");

        const sourceDetails = sources
            .map((source, index) => `### Source ${index + 1}\n${source}`)
            .join("\n\n---\n\n");
        const prompt = limitReferenceContext(
            `## Channel reference videos\n${videoDetails}\n\n## User sources\n${sourceDetails}`,
        );
        const systemPrompt = `You are an expert YouTube scriptwriter. Create an original, production-ready script.

CONTENT:
- Main topic: ${theme}
- Description: ${description}
- Target duration: ${minutesNumber} minutes

STYLE AND TONE:
- Infer only high-level traits such as pacing, narrative structure, tone, and transitions.
- Do not copy distinctive phrases, passages, or signature expressions from the references.
- Keep the result original and grounded in the user's sources.

TECHNICAL REQUIREMENTS:
- Write the complete script in the "script" field.
- Include timestamps, editing notes, and B-roll or graphics cues inside the script.
- Return a concise YouTube description and relevant SEO keywords.
- Aim for a realistic spoken duration rather than padding the text.

STRUCTURE:
1. Initial hook
2. Clearly segmented main body
3. Call to action
4. Natural closing

Return the structured JSON requested by the response schema.`;

        const generated = await generateStructuredScript({ prompt, systemPrompt });
        return { ok: true, data: generated };
    } catch (err) {
        return actionError(
            err,
            "GENERATION_FAILED",
            "The script could not be generated. Check the AI configuration and try again.",
        );
    }
}

export const editTranscript = async (input) => {
    try {
        await requireAuthenticatedUser();
        const { prompt, script } = z.object({
            prompt: z.string().min(2).max(250),
            script: scriptSchema,
        }).parse(input);

        const generated = await generateStructuredScript({
            systemPrompt: `You are an expert YouTube script editor. Apply the user's requested revision and return a complete replacement script. Preserve useful content that the request does not ask you to change. Return the structured JSON requested by the response schema.`,
            prompt: `## Current script
${JSON.stringify(script)}

## Requested revision
${prompt}`,
        });

        return { ok: true, data: generated };
    } catch (err) {
        return actionError(
            err,
            "REVISION_FAILED",
            "The script could not be revised. Check the AI configuration and try again.",
        );
    }
}
