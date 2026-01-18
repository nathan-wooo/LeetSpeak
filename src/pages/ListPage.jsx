
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowLeft, Lock, CheckCircle2 } from 'lucide-react';

const ListPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('All Topics');

  const questions = [
    { id: 1, title: "Two Sum", difficulty: "Easy", topic: "Array", solved: false, locked: false },
    { id: 2, title: "Contains Duplicate", difficulty: "Easy", topic: "Array", solved: false, locked: false },
    { id: 3, title: "Reverse Linked List", difficulty: "Medium", topic: "Linked List", solved: false, locked: false },
    { id: 4, title: "Median of Two Sorted Arrays", difficulty: "Hard", topic: "Array", solved: false, locked: false },
    { id: 5, title: "Longest Palindromic Substring", difficulty: "Medium", topic: "String", solved: false, locked: false },
    { id: 6, title: "Zigzag Conversion", difficulty: "Medium", topic: "String", solved: false, locked: false },
    { id: 7, title: "Regular Expression Matching", difficulty: "Hard", topic: "String", solved: false, locked: false },
    { id: 8, title: "Container With Most Water", difficulty: "Medium", topic: "Array", solved: false, locked: false },
  ];

  const topics = ["All Topics", "Array", "String", "Linked List", "Math", "Dynamic Programming", "Hash Table"];
  const difficulties = ["All", "Easy", "Medium", "Hard"];

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "Easy": return "text-green-400";
      case "Medium": return "text-yellow-400";
      case "Hard": return "text-red-400";
      default: return "text-slate-400";
    }
  };

  const getTopicColor = () => {
    return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  };

  const handleStartQuestion = (questionId) => {
    console.log(`Starting question ${questionId}`);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    const matchesTopic = selectedTopic === 'All Topics' || q.topic === selectedTopic;
    return matchesSearch && matchesDifficulty && matchesTopic;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-slate-200 font-sans">
      
      {/* Navbar */}
      <nav className="w-full h-16 flex items-center justify-between border-b border-white/10 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center pl-6 md:pl-8">
          <button 
            onClick={() => navigate('/')}
            className="mr-4 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br rounded-md flex items-center justify-center">
              <img src="Transparent_Logo.png" alt="LeetSpeak Logo" className="h-8 w-auto object-contain" />
            </div>
            <span className="text-xl font-bold text-white">Leet<span className="text-purple-400">Speak</span></span>
          </div>
        </div>
        <div className="pr-6 md:pr-8">
          <span className="text-sm text-slate-400">
            <span className="text-green-400 font-semibold">{questions.filter(q => q.solved).length}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{questions.length}</span>
            <span className="ml-2 text-slate-500">Solved</span>
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Practice Questions</h1>
          <p className="text-slate-400">Choose a problem and start practicing with voice guidance</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {/* Topic Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {topics.map(topic => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  selectedTopic === topic
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          {difficulties.map(diff => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(diff)}
              className={`px-6 py-3 font-semibold transition-all relative ${
                selectedDifficulty === diff
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {diff}
              {selectedDifficulty === diff && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"></div>
              )}
            </button>
          ))}
        </div>

        {/* Questions List */}
        <div className="space-y-2">
          {filteredQuestions.map((question) => (
            <div
              key={question.id}
              className="flex items-center gap-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-purple-500/50 hover:bg-slate-800/50 transition-all group"
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {question.solved ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : question.locked ? (
                  <Lock className="w-5 h-5 text-slate-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>
                )}
              </div>

              {/* Question Number & Title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-slate-500 font-mono text-sm">{question.id}.</span>
                  <h3 className={`text-lg font-semibold ${question.locked ? 'text-slate-600' : 'text-white'}`}>
                    {question.title}
                  </h3>
                </div>
              </div>

              {/* Topic Badge */}
              <div className="hidden text-center min-w-[80px] sm:block">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getTopicColor(question.topic)}`}>
                  {question.topic}
                </span>
              </div>

              {/* Difficulty */}
              <div className="hidden md:block text-center min-w-[80px]">
                <span className={`text-sm font-semibold ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty}
                </span>
              </div>

              {/* Action Button */}
              <div className="flex-shrink-0">
                {question.locked ? (
                  <button className="px-4 py-2 bg-slate-700/50 text-slate-500 rounded-lg cursor-not-allowed" disabled>
                    Locked
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartQuestion(question.id)}
                    className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500 hover:text-white transition-all font-semibold group-hover:scale-105"
                  >
                    Solve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredQuestions.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-500 text-lg">No questions found matching your filters</p>
          </div>
        )}

      </main>
    </div>
  );
};

export default ListPage;