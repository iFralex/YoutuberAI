"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, Download } from "lucide-react"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormRootError,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import { editTranscript } from "./actions"

const revisionSchema = z.object({
    prompt: z.string().min(2, {
        message: "Prompt must be at least 2 characters.",
    }).max(250, {
        message: "Prompt must be at most 250 characters.",
    }),
})

function formatScript(script) {
    return `# ${script.title}

## Script

${script.text}

## Description

${script.description}

## Keywords

${script.keywords.map((keyword) => "#" + keyword).join(" ")}
`
}

function downloadScript(script) {
    const blob = new Blob([formatScript(script)], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const safeTitle = script.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")

    anchor.href = url
    anchor.download = (safeTitle || "youtube-script") + ".md"
    anchor.click()
    URL.revokeObjectURL(url)
}

export function ScriptDialog({ props }) {
    const {
        youtuber,
        imageUrl,
        script: initialScript,
        date,
        mutable = false,
    } = props
    const [script, setScript] = useState(initialScript)
    const [pending, startTransition] = useTransition()
    const [copied, setCopied] = useState(false)
    const form = useForm({
        resolver: zodResolver(revisionSchema),
        defaultValues: { prompt: "" },
    })

    function onSubmit(values) {
        startTransition(async () => {
            const response = await editTranscript({
                script,
                prompt: values.prompt,
            })

            if (!response.ok) {
                form.setError("root.serverError", {
                    type: response.error.code,
                    message: response.error.message,
                })
                return
            }

            setScript(response.data.script)
            form.reset({ prompt: "" })
        })
    }

    async function copyScript() {
        await navigator.clipboard.writeText(formatScript(script))
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
    }

    return (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle className="flex items-center space-x-3">
                    <Avatar>
                        <AvatarImage src={imageUrl} />
                        <AvatarFallback>Profile image</AvatarFallback>
                    </Avatar>
                    <span>{script.title}</span>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                    <Badge variant="secondary">@{youtuber}</Badge>
                    <span>• {date}</span>
                </DialogDescription>
                <Separator />
            </DialogHeader>

            <section className="space-y-2">
                <Label>Script</Label>
                <ScrollArea className="h-[42vh] rounded-md border p-4">
                    <NewlineText text={script.text} />
                </ScrollArea>
            </section>

            <section className="space-y-2">
                <Label>Description</Label>
                <ScrollArea className="max-h-[24vh] rounded-md border p-4">
                    <p className="whitespace-pre-wrap">{script.description}</p>
                </ScrollArea>
            </section>

            <section className="space-y-2">
                <Label>Keywords</Label>
                <div className="flex flex-wrap gap-2">
                    {script.keywords.map((keyword) => (
                        <Badge key={keyword} variant="outline">#{keyword}</Badge>
                    ))}
                </div>
            </section>

            {mutable && (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Revise the script</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Make the opening more concise..."
                                            disabled={pending}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormRootError />
                        <Button type="submit" className="w-full" disabled={pending}>
                            {pending ? (
                                <>
                                    <LoadingSpinner size={18} />
                                    <span className="ml-2">Revising...</span>
                                </>
                            ) : "Regenerate script"}
                        </Button>
                    </form>
                </Form>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => downloadScript(script)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                </Button>
                <Button type="button" onClick={copyScript}>
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

export function ScriptPreview({ props }) {
    const { youtuber, imageUrl, script, date } = props
    const shortScript = script.text.length > 350
        ? script.text.slice(0, 350) + "..."
        : script.text

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                    <Avatar>
                        <AvatarImage src={imageUrl} />
                        <AvatarFallback>Profile image</AvatarFallback>
                    </Avatar>
                    <span>{script.title}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                    <Badge variant="secondary">@{youtuber}</Badge>
                    <span>• {date}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <NewlineText text={shortScript} />
            </CardContent>
            <CardFooter>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="w-full">Details</Button>
                    </DialogTrigger>
                    <ScriptDialog props={props} />
                </Dialog>
            </CardFooter>
        </Card>
    )
}

function NewlineText({ text }) {
    return (
        <div className="space-y-4 whitespace-pre-wrap">
            {text.split(/\n{2,}|——/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
            ))}
        </div>
    )
}
