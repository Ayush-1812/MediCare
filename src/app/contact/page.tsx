import React from 'react'

const Contact = () => {
    return (
        <div>
            <div className='text-center text-2xl pt-10 text-gray-500'>
                <p>CONTACT <span className='text-gray-700 font-bold'>US</span></p>
            </div>

            <div className='my-10 flex flex-col justify-center md:flex-row gap-10 mb-28 text-sm'>
                <img className='w-full md:max-w-[360px]' src="/assets/contact_image.png" alt="" />
                <div className='flex flex-col justify-center items-start gap-6'>
                    <p className='text-gray-500'>Tel: +919587567453 <br /> Email: ayushjangid5102@gmail.com</p>


                </div>
            </div>
        </div>
    )
}

export default Contact
