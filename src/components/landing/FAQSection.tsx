'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const faqs = [
    {
        question: "Is my data secure?",
        answer: "Yes, we use enterprise-grade encryption and comply with all healthcare data privacy regulations including HIPAA to ensure your information is strictly confidential and secure."
    },
    {
        question: "How does the AI work?",
        answer: "Our AI is trained on vast amounts of verified medical literature and data. It analyzes your symptoms and reports to provide personalized, evidence-based health insights and recommendations."
    },
    {
        question: "What does Telemedicine cost?",
        answer: "Telemedicine consultation fees vary depending on the specialist. You can view the consultation fee on each doctor's profile before booking an appointment."
    },
    {
        question: "What if I need a specialist?",
        answer: "MediCare's AI symptom checker will recommend the most appropriate type of specialist based on your symptoms, and you can easily browse our network to book an appointment."
    }
]

const FAQSection = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index)
    }

    return (
        <div className='py-20 md:mx-10 px-6 sm:px-10 lg:px-20 max-w-4xl mx-auto'>
            <h2 className='text-2xl md:text-3xl font-bold text-gray-900 mb-10 text-center'>FAQ</h2>
            
            <div className='flex flex-col gap-4'>
                {faqs.map((faq, index) => (
                    <div 
                        key={index} 
                        className={`border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300 ${openIndex === index ? 'bg-gray-50 shadow-sm' : 'bg-white hover:bg-gray-50'}`}
                    >
                        <button 
                            onClick={() => toggleFAQ(index)}
                            className='w-full flex justify-between items-center p-6 text-left focus:outline-none'
                        >
                            <span className='font-semibold text-gray-900'>{faq.question}</span>
                            {openIndex === index ? (
                                <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                        </button>
                        
                        <div 
                            className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            <p className='text-gray-600 text-sm leading-relaxed'>
                                {faq.answer}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default FAQSection
