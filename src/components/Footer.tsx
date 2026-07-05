import React from 'react'

const Footer = () => {
    return (
        <div className='md:mx-10 px-6 sm:px-10 lg:px-20'>
            <div className='flex flex-col sm:grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-14 my-10 mt-20 text-sm'>
                {/* Left Side */}
                <div className='md:col-span-2'>
                    <img className='mb-5 w-40' src="/assets/logo.svg" alt="MediCare Logo" />
                    <p className='w-full text-gray-600 leading-relaxed pr-0 md:pr-10'>
                        Medicare is your trusted partner for managing health appointments with ease. We connect patients with top-rated doctors across various specialties, ensuring quality healthcare is just a click away.
                    </p>
                </div>

                {/* Columns */}
                <div>
                    <p className='text-lg font-bold text-gray-900 mb-5'>COMPANY</p>
                    <ul className='flex flex-col gap-3 text-gray-600 font-medium'>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Home</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>About us</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Careers</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Press</li>
                    </ul>
                </div>

                <div>
                    <p className='text-lg font-bold text-gray-900 mb-5'>SERVICES</p>
                    <ul className='flex flex-col gap-3 text-gray-600 font-medium'>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>AI Chatbot</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Consultations</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Prescriptions</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Health Records</li>
                    </ul>
                </div>

                <div>
                    <p className='text-lg font-bold text-gray-900 mb-5'>SUPPORT</p>
                    <ul className='flex flex-col gap-3 text-gray-600 font-medium'>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Help Center</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Contact Us</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Privacy Policy</li>
                        <li className='hover:text-blue-600 cursor-pointer transition-colors'>Terms of Service</li>
                    </ul>
                </div>
            </div>

            {/* Copyright Text */}
            <div className='border-t border-gray-200 mt-10'>
                <p className='py-6 text-sm text-gray-500 text-center'>
                    © 2024 MediCare+. All rights reserved.
                </p>
            </div>
        </div>
    )
}

export default Footer
