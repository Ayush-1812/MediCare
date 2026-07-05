import React from 'react'
import { Activity, Brain, FileText, Pill, Ambulance, LineChart } from 'lucide-react'

const ecosystemFeatures = [
    {
        title: "Health Assistant",
        description: "Daily wellness and proactive care.",
        icon: <Activity className="w-8 h-8 text-blue-600" />
    },
    {
        title: "Health Memory",
        description: "Securely store and retrieve past health data.",
        icon: <Brain className="w-8 h-8 text-blue-600" />
    },
    {
        title: "Report Intelligence",
        description: "Decode complex medical reports.",
        icon: <FileText className="w-8 h-8 text-blue-600" />
    },
    {
        title: "Prescription Intelligence",
        description: "Manage and understand your medications.",
        icon: <Pill className="w-8 h-8 text-blue-600" />
    },
    {
        title: "Emergency Assessment",
        description: "AI guided emergency triage and advice.",
        icon: <Ambulance className="w-8 h-8 text-blue-600" />
    },
    {
        title: "Health Insights Dashboard",
        description: "Comprehensive overview of your health trends.",
        icon: <LineChart className="w-8 h-8 text-blue-600" />
    }
]

const AIEcosystemSection = () => {
    return (
        <div className='py-20 md:mx-10 px-6 sm:px-10 lg:px-20 bg-gray-50/50 rounded-3xl my-10'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-16 text-center'>AI Ecosystem</h2>
            
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10'>
                {ecosystemFeatures.map((feature, index) => (
                    <div key={index} className='bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col items-start'>
                        <div className='w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6'>
                            {feature.icon}
                        </div>
                        <h3 className='text-lg font-bold text-gray-900 mb-2'>{feature.title}</h3>
                        <p className='text-sm text-gray-600 leading-relaxed'>
                            {feature.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default AIEcosystemSection
