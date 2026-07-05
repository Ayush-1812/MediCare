import React from 'react'
import { Home, ClipboardList, Settings, Bot, Search, Calendar, FileText, LayoutDashboard, ChevronRight } from 'lucide-react'

const AIMockupsSection = () => {
    return (
        <div className='py-20 md:mx-10 px-6 sm:px-10 lg:px-20'>
            
            {/* Aether AI Health Memory Section */}
            <div className='mb-32'>
                <h2 className='text-2xl md:text-3xl font-bold text-gray-900 mb-10 text-center'>Aether AI Health Memory</h2>
                
                <div className='w-full max-w-4xl mx-auto bg-gray-50 rounded-3xl p-4 sm:p-8 border border-gray-100 shadow-2xl relative'>
                    {/* Mockup Window */}
                    <div className='bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row h-[400px]'>
                        {/* Sidebar */}
                        <div className='w-full md:w-64 bg-gray-50 border-r border-gray-200 p-4 hidden md:flex flex-col gap-2'>
                            <div className='flex items-center gap-2 mb-6 px-2'>
                                <Bot className="text-blue-600 w-6 h-6" />
                                <span className='font-bold text-gray-800 text-lg'>Aether</span>
                            </div>
                            <div className='flex items-center gap-3 bg-blue-100/50 text-blue-700 px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer'>
                                <Bot className="w-4 h-4" /> Chat
                            </div>
                            <div className='flex items-center gap-3 text-gray-600 hover:bg-gray-100 px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer transition-colors'>
                                <ClipboardList className="w-4 h-4" /> Records
                            </div>
                            <div className='flex items-center gap-3 text-gray-600 hover:bg-gray-100 px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer transition-colors'>
                                <Calendar className="w-4 h-4" /> Appointments
                            </div>
                            <div className='mt-auto flex items-center gap-3 text-gray-600 hover:bg-gray-100 px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer transition-colors'>
                                <Settings className="w-4 h-4" /> Settings
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className='flex-1 flex flex-col'>
                            <div className='border-b border-gray-100 p-4 flex justify-between items-center bg-white'>
                                <h3 className='font-bold text-gray-800'>Chat</h3>
                                <div className='w-8 h-8 rounded-full bg-blue-100'></div>
                            </div>
                            
                            <div className='flex-1 p-6 bg-gray-50 overflow-y-auto flex flex-col gap-6'>
                                <div className='self-end bg-blue-600 text-white text-sm p-4 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm'>
                                    Can you summarize my last appointment notes, Dr. Taylor?
                                </div>
                                <div className='self-start bg-white border border-gray-200 text-gray-700 text-sm p-4 rounded-2xl rounded-tl-sm max-w-[80%] shadow-sm'>
                                    <p className='font-bold mb-2 text-gray-900'>Sure! Your last appointment was on Oct 12th here are the details:</p>
                                    <ul className='list-disc pl-5 space-y-2'>
                                        <li><span className='font-bold'>Diagnosis:</span> Mild hypertension. Recommended lifestyle changes.</li>
                                        <li><span className='font-bold'>Prescription:</span> Lisinopril 10mg once daily. Refill due in 2 weeks.</li>
                                        <li><span className='font-bold'>Follow-up:</span> Scheduled for Jan 15th.</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div className='p-4 bg-white border-t border-gray-100'>
                                <div className='bg-gray-50 border border-gray-200 rounded-full flex items-center px-4 py-3'>
                                    <input type="text" placeholder="Type a message..." className='bg-transparent border-none outline-none flex-1 text-sm' disabled />
                                    <Bot className="w-5 h-5 text-blue-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Health Dashboard Preview Section */}
            <div className='mb-20'>
                <h2 className='text-2xl md:text-3xl font-bold text-gray-900 mb-10 text-center'>Health Dashboard Preview</h2>
                
                <div className='w-full max-w-4xl mx-auto bg-gray-50 rounded-3xl p-4 sm:p-8 border border-gray-100 shadow-2xl'>
                    {/* Mockup Window */}
                    <div className='bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row h-[450px]'>
                        {/* Sidebar */}
                        <div className='w-16 md:w-48 bg-white border-r border-gray-100 py-6 flex flex-col gap-2 items-center md:items-start'>
                            <div className='px-4 mb-8 hidden md:block'>
                                <span className='font-bold text-blue-600 text-lg'>MediCare+</span>
                            </div>
                            <div className='w-full flex justify-center md:justify-start md:px-4 py-3 text-blue-600 bg-blue-50 border-r-4 border-blue-600 cursor-pointer'>
                                <LayoutDashboard className="w-5 h-5 md:mr-3" />
                                <span className='hidden md:block font-semibold text-sm'>Dashboard</span>
                            </div>
                            <div className='w-full flex justify-center md:justify-start md:px-4 py-3 text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors'>
                                <ClipboardList className="w-5 h-5 md:mr-3" />
                                <span className='hidden md:block font-medium text-sm'>Appointments</span>
                            </div>
                            <div className='w-full flex justify-center md:justify-start md:px-4 py-3 text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors'>
                                <FileText className="w-5 h-5 md:mr-3" />
                                <span className='hidden md:block font-medium text-sm'>Reports</span>
                            </div>
                            <div className='mt-auto w-full flex justify-center md:justify-start md:px-4 py-3 text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors'>
                                <Settings className="w-5 h-5 md:mr-3" />
                                <span className='hidden md:block font-medium text-sm'>Settings</span>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className='flex-1 p-6 bg-gray-50/50 overflow-y-auto'>
                            <div className='flex justify-between items-center mb-6'>
                                <h3 className='font-bold text-xl text-gray-800'>Dashboard</h3>
                                <div className='flex items-center gap-3'>
                                    <div className='w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center'><Search className='w-4 h-4 text-gray-500'/></div>
                                    <div className='w-8 h-8 rounded-full bg-blue-100'></div>
                                </div>
                            </div>

                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
                                <div className='bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4'>
                                    <div className='w-12 h-12 rounded-full border-4 border-green-100 flex items-center justify-center'>
                                        <span className='font-bold text-green-600'>88</span>
                                    </div>
                                    <div>
                                        <p className='text-xs text-gray-500 font-medium'>Health Score</p>
                                        <p className='text-sm font-bold text-gray-800'>Strong</p>
                                    </div>
                                </div>
                                <div className='bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 col-span-2'>
                                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600'><Calendar className='w-5 h-5'/></div>
                                    <div className='flex-1'>
                                        <p className='text-xs text-gray-500 font-medium'>Upcoming Appointment</p>
                                        <p className='text-sm font-bold text-gray-800'>Dr. Sarah Davis</p>
                                    </div>
                                    <button className='text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold'>View Details</button>
                                </div>
                            </div>

                            <h4 className='font-bold text-gray-800 mb-4'>Recent Reports</h4>
                            <div className='bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col'>
                                <div className='p-4 border-b border-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors'>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center'><FileText className='w-4 h-4 text-blue-600'/></div>
                                        <div>
                                            <p className='text-sm font-bold text-gray-800'>Blood Test Results (Oct 15)</p>
                                            <p className='text-xs text-green-600 font-medium'>Reviewed</p>
                                        </div>
                                    </div>
                                    <ChevronRight className='w-4 h-4 text-gray-400' />
                                </div>
                                <div className='p-4 border-b border-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors'>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center'><FileText className='w-4 h-4 text-gray-500'/></div>
                                        <div>
                                            <p className='text-sm font-bold text-gray-800'>X-Ray Chest (Sep 02)</p>
                                            <p className='text-xs text-gray-500 font-medium'>Archived</p>
                                        </div>
                                    </div>
                                    <ChevronRight className='w-4 h-4 text-gray-400' />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Testimonials - Floating Bubbles */}
            <div className='flex flex-col md:flex-row items-center justify-center gap-6 mt-20 mb-10'>
                <div className='bg-white border border-gray-100 shadow-lg rounded-2xl rounded-tl-sm p-4 max-w-sm relative'>
                    <div className='absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-100 border-2 border-white'></div>
                    <p className='text-sm text-gray-700 font-medium leading-relaxed italic'>
                        "Medicare AI insights helped me understand my condition better than ever before."
                    </p>
                    <p className='text-xs text-gray-500 mt-2 font-bold'>- Sarah H.</p>
                </div>
                
                <div className='bg-blue-600 shadow-lg rounded-2xl rounded-bl-sm p-4 max-w-sm relative transform md:-translate-y-6'>
                    <div className='absolute -bottom-3 -left-3 w-8 h-8 rounded-full bg-white border-2 border-blue-600'></div>
                    <p className='text-sm text-white font-medium leading-relaxed italic'>
                        "Booking a top-rated specialist was incredibly fast and easy. Highly recommend!"
                    </p>
                    <p className='text-xs text-blue-200 mt-2 font-bold'>- David W.</p>
                </div>

                <div className='bg-white border border-gray-100 shadow-lg rounded-2xl rounded-tr-sm p-4 max-w-sm relative'>
                    <div className='absolute -top-3 -right-3 w-8 h-8 rounded-full bg-blue-100 border-2 border-white'></div>
                    <p className='text-sm text-gray-700 font-medium leading-relaxed italic'>
                        "The symptom checker was surprisingly accurate and guided me to the right care."
                    </p>
                    <p className='text-xs text-gray-500 mt-2 font-bold'>- Emily T.</p>
                </div>
            </div>

        </div>
    )
}

export default AIMockupsSection
