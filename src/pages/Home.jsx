import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Terminal, Users, MessageSquare, BookOpen, Mic, Zap } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  const handleStartCoding = () => {
    navigate('/list');
  };

  const stats = [
    { icon: <Users className="w-5 h-5" />, label: "Built for Students", value: "By Hackers" },
    { icon: <MessageSquare className="w-5 h-5" />, label: "Communication", value: "First Approach" },
    { icon: <BookOpen className="w-5 h-5" />, label: "Socratic Method", value: "Powered by AI" }
  ];

  const features = [
    { icon: <Mic />, text: "Voice-driven coding practice" },
    { icon: <Terminal />, text: "Real-time AI feedback" },
    { icon: <Zap />, text: "Socratic guidance, not answers" }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-slate-200 font-sans flex flex-col">
      
      {/* Navbar */}
      <nav className="w-full h-16 flex items-center justify-between border-b border-white/10 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center pl-6 md:pl-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br rounded-md flex items-center justify-center">
              <img src="Transparent_Logo.png" alt="LeetSpeak Logo" className="h-8 w-auto object-contain" />
            </div>
            <span className="text-xl font-bold text-white">Leet<span className="text-purple-400">Speak</span></span>
          </div>
        </div>
        <div className="pr-6 md:pr-8">
          <span className="text-sm text-slate-400 px-3 py-1.5 border border-purple-500/30 rounded-full bg-purple-500/5">
            Hacker
          </span>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative flex-grow flex flex-col justify-center px-6 md:px-12 lg:px-24 py-16 md:py-20">
        
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-600/5 blur-[100px] rounded-full"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-7xl mx-auto">
          
          {/* Hero Content */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16 mb-20 pt-12 md:pt-20">           
            {/* Left Side  */}
            <div className="flex-1 text-center lg:text-left opacity-0 animate-[fadeInUp_0.8s_ease-out_0.2s_forwards]">
              <div className="inline-block mb-6">
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-white mb-6 leading-[1.05]">
                Leet<span className="text-purple-400">Speak</span>;
              </h1>
              
              <div className="space-y-2 mb-8">
                <p className="text-xl md:text-3xl font-light text-slate-400">
                  Real interviews aren't silent
                </p>
                <p className="text-xl md:text-3xl font-semibold text-white">
                  Learn to <span className="text-purple-400">speak</span> your code
                </p>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-10">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full text-sm text-slate-300">
                    <span className="text-purple-400">{feature.icon}</span>
                    {feature.text}
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button 
                  onClick={handleStartCoding}
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-950 font-bold text-lg rounded-lg hover:bg-purple-400 hover:text-white transition-all duration-300 shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105"
                >
                  <Terminal className="w-5 h-5" />
                  Start Coding
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border-2 border-slate-600 text-slate-200 font-semibold text-lg rounded-lg hover:border-purple-400 hover:bg-purple-400/10 transition-all duration-300">
                  Watch Demo
                </button>
              </div>
            </div>

            {/* Right Side Image */}
            <div className="hidden lg:block flex-shrink-0 opacity-0 animate-[fadeInUp_0.8s_ease-out_1s_forwards]">
              <div className="relative w-64 h-64">
                <div className="absolute inset-0 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 shadow-2xl">
                  <div className="flex gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                  </div>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="text-purple-400">function twoSum(nums) {'{'}  </div>
                    <div className="text-slate-400 pl-4">// "Let me think..."</div>
                    <div className="text-cyan-400 pl-4">const map = new Map();</div>
                    <div className="text-slate-500 pl-4">...</div>
                    <div className="text-purple-400">{'}'}</div>
                  </div>
                  
                  {/* Mic Indicator */}
                  <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50 animate-pulse">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Glow effect */}
                <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full -z-10"></div>
              </div>
            </div>

          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-white/10">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="flex items-start gap-4 p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-purple-500/50 transition-all duration-300 opacity-0"
                style={{
                  animation: `fadeInUp 0.8s ease-out ${1.8 + index * 0.2}s forwards`
                }}
              >,
                <div className="text-purple-400 mt-1 bg-purple-500/10 p-2 rounded-lg">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-lg font-semibold text-white">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="mt-36 text-center opacity-0 animate-[fadeInUp_0.8s_ease-out_3.0s_forwards]">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-slate-400 text-lg mb-12 max-w-2xl mx-auto">
              Practice LeetCode while explaining your thought process. Get real-time Socratic guidance from AI.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { num: "1", title: "Code & Speak", desc: "Solve problems while verbalizing your approach" },
                { num: "2", title: "AI Listens", desc: "AI analyzes your code and thinking process" },
                { num: "3", title: "Get Guided", desc: "Receive feedback to guide you through the problem" }
              ].map((step, idx) => (
                <div key={idx} className="relative p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                  <div className="text-5xl font-bold text-purple-500/20 mb-3">{step.num}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Home;