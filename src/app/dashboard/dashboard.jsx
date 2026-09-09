import { db } from "@/components/firebase";
import { Container } from "@/components/sections/Container";
import { getDoc, doc, collection, getDocs } from "firebase/firestore";

import { Navbar } from "@/components/sections/Navbar";
import { Separator } from "@/components/ui/separator";
import { ScriptPreview } from "../scriptDialog";
import { Pricing } from "@/components/sections/Pricing";
import { prices } from "@/components/sections/data";
import { MainForm } from "@/components/form";

export async function Dashboard({ id }) {
    const scripts = []
    const querySnapshot = await getDocs(collection(db, id));
    querySnapshot.forEach(doc => scripts.push(Object.assign({ id: doc.id }, doc.data())))
    scripts.sort((a, b) => new Date(b.date.seconds * 1000) - new Date(a.date.seconds * 1000));
    scripts.map(item => {
        item.date = new Date(item.date.seconds * 1000)
        item.date = item.date.toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '')
        return item
    })
    const user = await getDoc(doc(db, "users", id));
    if (!user.data())
        return <Navbar logged={-1} />
    const { username, credits } = user.data()

    return <>
        <Navbar logged={-1} />
        <Container>
            <h1 className="text-4xl font-bold">Dashboard di {username}</h1>
            <Separator className="my-5" />
            <MainForm />
            <Separator className="my-5" />

            <h2 className="text-4xl font-bold my-3">Crediti: <span className="text-indigo-500">{credits}</span></h2>
            <Pricing data={prices} />

            <Separator className="my-5" />
            <h2 className="text-4xl font-bold my-3">Script generati</h2>
            {scripts.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
                {scripts.map(data => (
                    <ScriptPreview key={data.id} props={data} />
                ))}
            </div> :
                <div className="flex justify-center w-full">
                    <p>You haven't generated scripts yet</p>
                </div>}
        </Container>
    </>
}
