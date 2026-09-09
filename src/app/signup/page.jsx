"use client";

import { useTransition } from "react";
import { createUserWithEmailAndPassword, reateUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/components/firebase";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/sections/Navbar";
import { z } from "zod";

import { Button } from "@/components/ui/button"
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormRootError,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/sections/Container";
import { doc, setDoc } from "firebase/firestore";
import { LoginAccount } from "../login/page";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/loading";

const signUpSchema = z
    .object({
        username: z.string().min(3, { message: "Username is too short" }),
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be 6 characters long"),
        password2: z.string(),
    })
    .refine((data) => data.password === data.password2, {
        message: "Passwords must match",
        path: ["password2"],
    });

export default function Register() {
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(signUpSchema),
    })

    function onSubmit(values) {
        startTransition(async () => {
            try {
                await createUserWithEmailAndPassword(auth, values.email, values.password);
                let userId = await LoginAccount(values.email, values.password);
                console.log("id", userId)

                await setDoc(doc(db, "users", userId), { credits: 1, username: values.username })
                router.push("/dashboard");
            } catch (e) {
                form.setError("root.serverError", {
                    type: e.code,
                    message: e.message
                })
            }
        })
    }

    return (
        <>
            <Navbar />
            <Container className="flex justify-center">
                <Card className="w-[350px]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardHeader>
                                <CardTitle>Sign Up</CardTitle>
                                <CardDescription>Create your account and get 1 FREE credit!</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col space-y-3">
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <Label htmlFor="username">Your user name</Label>
                                                <Input id="username" placeholder="John Doe..." {...field} />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <Label htmlFor="email">Your email address</Label>
                                                <Input id="email" type="email" placeholder="example@name.com..." {...field} />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <Label htmlFor="password">Password</Label>
                                                <Input id="password" type="password" placeholder="··········" {...field} />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password2"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <Label htmlFor="password2">Confirm password</Label>
                                                <Input id="password2" type="password" placeholder="··········" {...field} />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormRootError />
                            </CardContent>
                            <CardFooter className="grid grid-cols-1 text-right">
                                <Button type="submit" disabled={pending} className="my-2">{pending ? <LoadingSpinner /> : "Create Account"}</Button>
                                <p>Have already an account? <Link href="/login" className="text-link">Log in</Link></p>
                            </CardFooter>
                        </form>
                    </Form >
                </Card >
            </Container>
        </>
    );
}