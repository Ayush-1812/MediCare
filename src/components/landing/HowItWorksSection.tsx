import React from 'react'
import { User, MessageSquarePlus, Bot, Stethoscope, ArrowRight } from 'lucide-react'

const steps = [
    {
        title: "Create Account",
        description: "Sign up and build your secure health profile.",
        icon: <User className="w-8 h-8 text-gray-700" />
    },
    {
        title: "Describe Symptoms",
        description: "Share your health concerns with our AI.",
        icon: <MessageSquarePlus className="w-8 h-8 text-gray-700" />
    },
    {
        title: "AI Insights",
        description: "Receive immediate, data-driven health analysis.",
        icon: <Bot className="w-8 h-8 text-gray-700" />
    },
    {
        title: "Consult Doctor",
        description: "Book and consult with recommended specialists.",
        icon: <Stethoscope className="w-8 h-8 text-gray-700" />
    }
]

const HowItWorksSection = () => {
    return (
        <div className='py-20 md:mx-10 px-6 sm:px-10 lg:px-20 bg-white text-center'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-16'>How It Works</h2>
            
            <div className='flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 relative'>
                {steps.map((step, index) => (
                    <React.Fragment key={index}>
                        <div className='flex flex-col items-center text-center w-full md:w-1/4 z-10'>
                            <div className='w-24 h-24 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center mb-6 shadow-sm hover:border-blue-500 hover:text-blue-500 transition-colors duration-300'>
                                {step.icon}
                            </div>
                            <h3 className='text-lg font-bold text-gray-900 mb-3'>{step.title}</h3>
                            <p className='text-sm text-gray-500 px-4'>
                                {step.description}
                            </p>
                        </div>
                        
                        {/* Arrow connector for desktop */}
                        {index < steps.length - 1 && (
                            <div className='hidden md:flex items-center justify-center flex-1 z-0'>
                                <ArrowRight className="text-gray-300 w-8 h-8" />
                            </div>
                        )}

                        {/* Arrow connector for mobile */}
                        {index < steps.length - 1 && (
                            <div className='md:hidden flex items-center justify-center py-2'>
                                <ArrowRight className="text-gray-300 w-6 h-6 transform rotate-90" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    )
}

export default HowItWorksSection
