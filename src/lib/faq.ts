/**
 * MediCare's own FAQ content.
 *
 * Extracted from `components/landing/FAQSection.tsx`, which previously held it inline.
 * The voice receptionist answers FAQ questions from this module, so the spoken answer and
 * the answer on the landing page are the same text — if they lived in two places they
 * would eventually disagree, and a receptionist contradicting the website is worse than
 * one that cannot answer at all.
 *
 * This is the only "knowledge base" the agent has. It is deliberately tiny and entirely
 * first-party: no retrieval over scraped pages, nothing a third party can edit.
 */

export type FaqTopic =
    | 'data_security'
    | 'how_ai_works'
    | 'consultation_cost'
    | 'finding_a_specialist'

export type FaqEntry = {
    topic: FaqTopic
    question: string
    answer: string
}

export const FAQS: FaqEntry[] = [
    {
        topic: 'data_security',
        question: 'Is my data secure?',
        answer:
            'Yes, we use enterprise-grade encryption and comply with all healthcare data privacy regulations including HIPAA to ensure your information is strictly confidential and secure.',
    },
    {
        topic: 'how_ai_works',
        question: 'How does the AI work?',
        answer:
            'Our AI is trained on vast amounts of verified medical literature and data. It analyzes your symptoms and reports to provide personalized, evidence-based health insights and recommendations.',
    },
    {
        topic: 'consultation_cost',
        question: 'What does Telemedicine cost?',
        answer:
            "Telemedicine consultation fees vary depending on the specialist. You can view the consultation fee on each doctor's profile before booking an appointment.",
    },
    {
        topic: 'finding_a_specialist',
        question: 'What if I need a specialist?',
        answer:
            "MediCare's AI symptom checker will recommend the most appropriate type of specialist based on your symptoms, and you can easily browse our network to book an appointment.",
    },
]

export const FAQ_TOPICS = FAQS.map((f) => f.topic)

export function faqFor(topic: string): FaqEntry | undefined {
    return FAQS.find((f) => f.topic === topic)
}

/** Where to send someone whose question the FAQ does not cover. */
export const SUPPORT_ROUTE = '/contact'
