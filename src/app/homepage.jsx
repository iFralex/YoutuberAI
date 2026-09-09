import { Container } from "@/components/sections/Container";
import { Hero } from "@/components/sections//Hero";
import { SectionTitle } from "@/components/sections//SectionTitle";
import { Benefits } from "@/components/sections//Benefits";
import { Video } from "@/components/sections//Video";
import { Testimonials } from "@/components/sections//Testimonials";
import { Faq } from "@/components/sections//Faq";
import { Cta } from "@/components/sections//Cta";

import { benefitOne, benefitTwo, comparison, faq, navigation, prices, reviews } from "@/components/sections/data";
import { Comparison } from "@/components/sections/Comparison";
import { Pricing } from "@/components/sections/Pricing";
import { Navbar } from "@/components/sections/Navbar";

export default function Home({ email }) {
    return (
        <>
            <Navbar navigation={navigation} logged={email !== undefined} />
            <Container>
                <Hero logged={email !== undefined} />
                <SectionTitle
                    preTitle="INNOVAZIONE PER CREATOR"
                    title=" Perché Scegliere Youtuber AI
"
                >
                    Youtuber AI semplifica il tuo flusso di lavoro creativo. Il nostro servizio analizza lo stile del creator scelto, incorpora le tue fonti e segue le tue istruzioni specifiche.
                    <br />Risparmi tempo prezioso nella fase di scrittura, permettendoti di concentrarti sulla produzione e sul miglioramento della qualità dei tuoi contenuti.
                    <br />Che tu sia un creator esperto o un nuovo youtuber, Youtuber AI offre un supporto concreto per ottimizzare il tuo processo creativo.
                </SectionTitle>

                <Benefits data={benefitOne} id="benefits-1" />
                <Benefits imgPos="right" data={benefitTwo} />

                <Comparison data={comparison} id={"choose-creators"} />

                <SectionTitle
                    preTitle="COSA DICONO I NOSTRI UTENTI"
                    title="Esperienze Reali con Youtuber AI"
                >
                    I nostri utenti hanno sperimentato un significativo miglioramento nella loro produzione di contenuti. Ecco alcune delle loro opinioni:
                </SectionTitle>

                <Testimonials data={reviews} id="testimonies" />

                <SectionTitle id="pricing" preTitle="Prezzi" title="Acquista i credits" custom={true}>
                    {email === undefined && <Cta title={<span>1 CREDITO in regalo!</span>} desc="Prova Youtuber AI gratuitamente creando un account" buttonText="Registrati ora" buttonLink="/signup" />}
                </SectionTitle>
                <Pricing data={prices} />

                <SectionTitle id="faq" preTitle="FAQ" title="Domande Frequenti su Youtuber AI">
                    Hai delle domande sul nostro servizio? Ecco le risposte alle domande più comuni dei nostri utenti:
                </SectionTitle>

                <Faq data={faq} />
            </Container>
        </>
    );
}
