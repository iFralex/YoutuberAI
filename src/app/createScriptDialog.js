"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FileUp, FileX } from "lucide-react"
import { useCallback, useState, useTransition } from "react"
import { useDropzone } from "react-dropzone"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormRootError,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import {
    Table,
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { getGeneratedTranscript } from "./actions"
import { ScriptDialog } from "./scriptDialog"

const MAX_FILE_SIZE = 1024 * 1024
const MAX_FILES = 4

const formSchema = z.object({
    theme: z.string().min(2, {
        message: "Theme text must be at least 2 characters.",
    }).max(50, {
        message: "Theme text must be at most 50 characters.",
    }),
    description: z.string().min(20, {
        message: "Description must be at least 20 characters.",
    }).max(600, {
        message: "Description must be at most 600 characters.",
    }),
    minutesNumber: z.number().min(2, { message: "Too short" }).max(20, { message: "Too long" }),
    videosCount: z.number().min(5, { message: "Too few" }).max(50, { message: "Too many" }),
    files: z.array(z.object({ value: z.custom((file) => file instanceof File) }))
        .min(1, { message: "Please add at least one source." })
        .max(MAX_FILES, { message: "Max sources: 4" }),
})

async function extractTextFromFiles(files) {
    return Promise.all(files.map(async (file) => {
        if (file.size > MAX_FILE_SIZE) {
            throw new Error("File " + file.name + " exceeds the 1 MB size limit.")
        }

        if (file.type && !file.type.startsWith("text/")) {
            throw new Error("File " + file.name + " is not a supported text file.")
        }

        return file.text()
    }))
}

export function CreateDialog({ data }) {
    const [pending, startTransition] = useTransition()
    const [result, setResult] = useState(null)

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            theme: "",
            description: "",
            minutesNumber: 10,
            videosCount: 15,
            files: [],
        },
    })

    function onSubmit(values) {
        startTransition(async () => {
            try {
                const sources = await extractTextFromFiles(
                    values.files.map(({ value }) => value),
                )
                const response = await getGeneratedTranscript({
                    channelId: data.id,
                    theme: values.theme,
                    description: values.description,
                    minutesNumber: values.minutesNumber,
                    videosCount: values.videosCount,
                    sources,
                })

                if (!response.ok) {
                    form.setError("root.serverError", {
                        type: response.error.code,
                        message: response.error.message,
                    })
                    return
                }

                setResult(response.data)
            } catch (error) {
                form.setError("root.serverError", {
                    type: "SOURCE_READ_FAILED",
                    message: error.message || "The source files could not be read.",
                })
            }
        })
    }

    if (pending) {
        return (
            <Dialog defaultOpen>
                <DialogContent className="flex h-[50%] w-[50%] items-center">
                    <div className="flex h-full w-full items-center justify-center">
                        <LoadingSpinner size={35} />
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    if (result) {
        return (
            <Dialog defaultOpen>
                <ScriptDialog
                    props={{
                        youtuber: data.youtuber,
                        imageUrl: data.image.url,
                        script: result.script,
                        date: new Date().toLocaleString("it-IT"),
                        mutable: true,
                    }}
                />
            </Dialog>
        )
    }

    return (
        <Dialog defaultOpen>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-3">
                        <Avatar>
                            <AvatarImage src={data.image.url} />
                            <AvatarFallback>Profile image</AvatarFallback>
                        </Avatar>
                        <span>{data.youtuber}</span>
                    </DialogTitle>
                    <DialogDescription>
                        Upload theme and sources to generate a script with the style of {data.youtuber}
                    </DialogDescription>
                    <Separator />
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <FormField
                            control={form.control}
                            name="theme"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Video Theme</FormLabel>
                                    <FormDescription>Write the theme of your video.</FormDescription>
                                    <FormControl>
                                        <Input placeholder="How feathered dinosaurs changed paleontology" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormDescription>
                                        Describe the angle, audience, style, and facts the script should emphasize.
                                    </FormDescription>
                                    <FormControl>
                                        <Textarea placeholder="Create an accessible science story for curious adults..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="minutesNumber"
                            render={({ field: { value, onChange } }) => (
                                <FormItem>
                                    <FormLabel>Duration in minutes: {value}</FormLabel>
                                    <FormDescription>Choose a target duration between 2 and 20 minutes.</FormDescription>
                                    <FormControl>
                                        <Slider value={[value]} min={2} max={20} step={1} onValueChange={(number) => onChange(number[0])} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="videosCount"
                            render={({ field: { value, onChange } }) => (
                                <FormItem>
                                    <FormLabel>Videos to analyze: {value}</FormLabel>
                                    <FormDescription>
                                        More videos provide a broader style sample but take longer to process.
                                    </FormDescription>
                                    <FormControl>
                                        <Slider value={[value]} min={5} max={50} step={1} onValueChange={(number) => onChange(number[0])} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="files"
                            render={() => (
                                <FormItem>
                                    <FormLabel>Sources</FormLabel>
                                    <FormDescription>
                                        Upload up to 4 text, Markdown, or CSV files, maximum 1 MB each.
                                    </FormDescription>
                                    <FileUpload form={form} />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormRootError />
                        <DialogFooter>
                            <Button type="submit" disabled={pending}>Generate script</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export function FileUpload({ form }) {
    const {
        fields,
        append,
        remove,
    } = useFieldArray({
        name: "files",
        control: form.control,
    })

    const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
        if (rejectedFiles.length) {
            form.setError("files", {
                type: "validate",
                message: "Use text, Markdown, or CSV files up to 1 MB each.",
            })
            return
        }

        if (fields.length + acceptedFiles.length > MAX_FILES) {
            form.setError("files", {
                type: "max",
                message: "Max sources: 4",
            })
            return
        }

        append(acceptedFiles.map((file) => ({ value: file })))
        form.clearErrors("files")
    }, [append, fields.length, form])

    const { isDragActive, getRootProps, getInputProps } = useDropzone({
        onDrop,
        multiple: true,
        maxSize: MAX_FILE_SIZE,
        maxFiles: MAX_FILES,
        accept: {
            "text/plain": [".txt", ".md", ".markdown"],
            "text/csv": [".csv"],
        },
    })

    return (
        <div>
            <div
                {...getRootProps({
                    className: cn(
                        "mb-4 flex w-full cursor-pointer flex-col items-center justify-center rounded-md p-3",
                        isDragActive ? "bg-white" : "bg-[#ddf] dark:bg-[#113]",
                    ),
                })}
            >
                <Label
                    htmlFor="sources"
                    className={cn(
                        "cursor-pointer text-center text-sm focus:underline",
                        form.formState.errors.files && "text-red-500",
                    )}
                >
                    <div className="flex w-full justify-center p-4">
                        <FileUp strokeWidth={1.25} size={48} />
                    </div>
                    <span>{isDragActive ? "Drop here" : "Click to upload or drag and drop"}</span>
                    <input id="sources" {...getInputProps()} />
                </Label>
            </div>

            <Table>
                <TableBody>
                    {fields.map((field, index) => (
                        <TableRow key={field.id}>
                            <TableCell>{field.value.name}</TableCell>
                            <TableCell className="text-right">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    aria-label={"Remove " + field.value.name}
                                    onClick={() => remove(index)}
                                >
                                    <FileX strokeWidth={1.25} />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
