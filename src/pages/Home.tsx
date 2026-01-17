import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Terminal, Users, MessageSquare, BookOpen } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const stats = [
    { icon: <Users className="w-5 h-5" />, label: "Built for Students", value: "By Hackers" },
    { icon: <MessageSquare className="w-5 h-5" />, label: "Communication", value: "First Approach" },
    { icon: <BookOpen className="w-5 h-5" />, label: "Socratic Method", value: "Powered by AI" }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-slate-200 font-sans flex flex-col">
      
      {/* Navbar */}
      <nav className="w-full h-16 flex items-center border-b border-white/10 bg-gray-900">
        <div className="flex items-center pl-4 md:pl-6">
          <img 
            src="Logo_Transparent.png" 
            alt="LeetSpeak Logo" 
            className="h-10 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity cursor-pointer" 
          />
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative flex-grow flex flex-col justify-center px-8 md:px-16 lg:px-24 pb-20 pt-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 blur-[120px] rounded-full"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-7xl mx-auto">
          {/* Hero Content */}
          <div className="flex items-center gap-12 lg:gap-24 mb-16">
            
            {/* Left Side */}
            <div className="flex-1">
              <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter text-white mb-8 leading-[1.1]">
                Leet <span className="text-purple-400">Speak</span>;
              </h1>
              <div className="space-y-3 mb-8">
                <p className="text-2xl md:text-4xl font-light text-slate-400">
                  Real interviews aren't silent
                </p>
                <p className="text-2xl md:text-4xl font-semibold text-white">
                  Learn to <span className="text-purple-400">speak</span> your code
                </p>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center">
              <button 
                onClick={() => navigate('/interview')}
                className="group relative inline-flex items-center gap-2 px-10 py-5 bg-white text-slate-950 font-bold text-lg rounded-lg hover:bg-purple-400 hover:text-white transition-all duration-300 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105"
              >
                <Terminal className="w-5 h-5" />
                Start Coding
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

          {/* Stats Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="text-purple-400 mt-1">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-lg font-semibold text-white">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;