import React from 'react'
import { BrainCircuit, HeartPulse, FileSearch, Video } from 'lucide-react'

const features = [
    {
        title: "AI Health Assistant",
        description: "34/7 personalized health monitoring and proactive wellness tips powered by AI.",
        icon: <BrainCircuit className="w-6 h-6 text-blue-600" />
    },
    {
        title: "Smart Symptom Checker",
        description: "Accurate symptom analysis to guide you towards the right care pathway.",
        icon: <HeartPulse className="w-6 h-6 text-blue-600" />
    },
    {
        title: "Medical Report Intelligence",
        description: "Understand your lab results and reports with plain language explanations.",
        icon: <FileSearch className="w-6 h-6 text-blue-600" />
    },
    {
        title: "Telemedicine",
        description: "Consult top-rated doctors instantly through secure video conferencing.",
        icon: <Video className="w-6 h-6 text-blue-600" />
    }
]

const WhyChooseSection = () => {
    return (
        <div id="features" className='py-20 md:mx-10 px-6 sm:px-10 lg:px-20 text-center'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-16'>Why Choose MediCare</h2>
            
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8'>
                {features.map((feature, index) => (
                    <div key={index} className='bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 flex flex-col items-center text-center'>
                        <div className='w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6'>
                            {feature.icon}
                        </div>
                        <h3 className='text-xl font-bold text-gray-900 mb-4'>{feature.title}</h3>
                        <p className='text-gray-600 leading-relaxed text-sm'>
                            {feature.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default WhyChooseSection
