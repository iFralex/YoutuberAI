import "server-only"

import { GoogleGenAI } from "@google/genai"
import { z } from "zod"

const DEFAULT_MODEL = "gemini-3.5-flash"
const MAX_CONTEXT_CHARACTERS = 700_000

const vertexOutputSchema = z.object({
    title: z.string().min(1),
    script: z.string().min(1),
    description: z.string().min(1),
    keywords: z.array(z.string().min(1)).min(1),
})

const responseJsonSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        title: { type: "string", minLength: 1 },
        script: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        keywords: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
        },
    },
    required: ["title", "script", "description", "keywords"],
}

function parseServiceKey() {
    if (!process.env.GOOGLE_SERVICE_KEY) return null

    try {
        return JSON.parse(
            Buffer.from(process.env.GOOGLE_SERVICE_KEY, "base64").toString("utf8"),
        )
    } catch {
        throw new Error("GOOGLE_SERVICE_KEY is not valid base64-encoded JSON.")
    }
}

function createGenAIClient() {
    const serviceKey = parseServiceKey()
    const project =
        process.env.VERTEX_PROJECT_NAME ||
        serviceKey?.project_id ||
        process.env.GOOGLE_CLOUD_PROJECT
    const location =
        process.env.VERTEX_LOCATION ||
        process.env.GOOGLE_CLOUD_LOCATION ||
        "global"
    const clientEmail =
        process.env.VERTEX_AUTH_EMAIL || serviceKey?.client_email
    const privateKey = (
        process.env.VERTEX_AUTH_PRIVATE_KEY || serviceKey?.private_key || ""
    ).replace(/\\n/g, "\n")
    const clientId =
        process.env.VERTEX_AUTH_CLIENT_ID || serviceKey?.client_id

    if (!project) {
        throw new Error(
            "Vertex AI is not configured: set VERTEX_PROJECT_NAME or GOOGLE_SERVICE_KEY.",
        )
    }

    const options = {
        vertexai: true,
        project,
        location,
        apiVersion: "v1",
    }

    if (clientEmail && privateKey) {
        options.googleAuthOptions = {
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
                ...(clientId ? { client_id: clientId } : {}),
            },
        }
    }

    return new GoogleGenAI(options)
}

function extractResponseText(response) {
    const text = response?.text?.trim()

    if (!text) {
        const blockedReason = response?.promptFeedback?.blockReason
        throw new Error(
            blockedReason
                ? "Vertex AI blocked the request: " + blockedReason + "."
                : "Vertex AI returned no generated content.",
        )
    }

    return text
}

export async function generateStructuredScript({ prompt, systemPrompt }) {
    if (!prompt || prompt.length > MAX_CONTEXT_CHARACTERS) {
        throw new Error("The generation context is empty or too large.")
    }

    const modelName = process.env.VERTEX_MODEL || DEFAULT_MODEL
    const response = await createGenAIClient().models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseJsonSchema,
            temperature: 0.7,
            maxOutputTokens: 8192,
        },
    })

    let parsed
    try {
        parsed = JSON.parse(extractResponseText(response))
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error("Vertex AI returned malformed JSON.")
        }
        throw error
    }

    const validated = vertexOutputSchema.safeParse(parsed)
    if (!validated.success) {
        throw new Error("Vertex AI returned an invalid script structure.")
    }

    return {
        model: modelName,
        script: {
            title: validated.data.title,
            text: validated.data.script,
            description: validated.data.description,
            keywords: validated.data.keywords,
        },
    }
}
