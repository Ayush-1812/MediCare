import React from 'react'

const Footer = () => {
    return (
        <div className='md:mx-10'>
            <div className='flex flex-col sm:grid grid-cols-[3fr_1fr_1fr] gap-14 my-10 mt-40 text-sm'>
                {/* Left Side */}
                <div>
                    <img className='mb-5 w-40' src="/assets/logo.svg" alt="" />
                    <p className='w-full md:w-2/3 text-gray-600 leading-6'>
                        Medicare is your trusted partner for managing health appointments with ease. We connect patients with top-rated doctors across various specialties, ensuring quality healthcare is just a click away.
                    </p>
                </div>

                {/* Center Side */}
                <div>
                    <p className='text-xl font-medium mb-5'>COMPANY</p>
                    <ul className='flex flex-col gap-2 text-gray-600 font-medium'>
                        <li>Home</li>
                        <li>About us</li>
                        <li>Contact us</li>
                        <li>Privacy policy</li>
                    </ul>
                </div>

                {/* Right Side */}
                <div>
                    <p className='text-xl font-medium mb-5'>GET IN TOUCH</p>
                    <ul className='flex flex-col gap-2 text-gray-600 font-medium'>
                        <li>+919587567453</li>
                        <li>ayushjangid5102@gmail.com</li>
                    </ul>
                </div>
            </div>

            {/* Copyright Text */}
            <div>
                <hr />
                <p className='py-5 text-sm text-center'>Copyright 2024@ Medicare - All Right Reserved.</p>
            </div>
        </div>
    )
}

export default Footer
