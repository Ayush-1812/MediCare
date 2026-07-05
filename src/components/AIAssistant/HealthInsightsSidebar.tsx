import React from 'react';
import { Calendar, Pill, FileText, Info } from 'lucide-react';

const HealthInsightsSidebar: React.FC = () => {
  return (
    <div className="h-full flex flex-col space-y-8">
      {/* Action Center */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">Action Center</h3>
        
        <div className="space-y-4">
          {/* Upcoming Appointments Empty State */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[20px] p-6 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.06)] border border-white/80 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-50/80 p-2 rounded-xl text-blue-500 border border-blue-100/50 shadow-sm">
                <Calendar className="w-4 h-4" />
              </div>
              <h4 className="text-[13px] font-bold text-gray-800 tracking-wide">Upcoming Appointments</h4>
            </div>
            <div className="flex flex-col items-center justify-center py-6 px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <Info className="w-5 h-5 text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 font-medium text-center">No upcoming appointments</p>
            </div>
          </div>

          {/* Active Prescriptions Empty State */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[20px] p-6 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.06)] border border-white/80 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-teal-50/80 p-2 rounded-xl text-teal-500 border border-teal-100/50 shadow-sm">
                <Pill className="w-4 h-4" />
              </div>
              <h4 className="text-[13px] font-bold text-gray-800 tracking-wide">Active Prescriptions</h4>
            </div>
            <div className="flex flex-col items-center justify-center py-6 px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <Info className="w-5 h-5 text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 font-medium text-center">No active prescriptions</p>
            </div>
          </div>

          {/* Recent Reports Empty State */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[20px] p-6 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.06)] border border-white/80 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-50/80 p-2 rounded-xl text-purple-500 border border-purple-100/50 shadow-sm">
                <FileText className="w-4 h-4" />
              </div>
              <h4 className="text-[13px] font-bold text-gray-800 tracking-wide">Recent Reports</h4>
            </div>
            <div className="flex flex-col items-center justify-center py-6 px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <Info className="w-5 h-5 text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 font-medium text-center">No recent reports available</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HealthInsightsSidebar;

