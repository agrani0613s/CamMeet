import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const nav = useNavigate();

  const create = () => {
    if (!name.trim()) return alert('Please enter your name before creating a meeting.');
    const id = uuidv4();
    nav(`/room/${id}`, { state: { isCreator: true, name } });
  };

  const join = () => {
    if (!name.trim() || !roomId.trim()) return alert('Please enter your name and Room ID to join.');
    nav(`/room/${roomId}`, { state: { isCreator: false, name } });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left: Hero */}
      <div className="flex items-center justify-center p-6 bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-xl transform motion-safe:transition-transform motion-safe:hover:-translate-y-1 p-6 lg:p-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-md">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7h2l2-3h10l2 3h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CamMeet</h1>
                <p className="text-sm text-slate-500 dark:text-slate-300">Fast, private video meetings</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
              Meetings that feel <span className="text-indigo-600 dark:text-indigo-400">simple</span> and <span className="text-pink-500 dark:text-pink-400">reliable</span>.
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-300 max-w-xl">
              Create or join a video meeting instantly. No installs — just open your browser, allow camera & microphone, and you're ready to collaborate.
            </p>

            {/* <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-white/5">
                <div className="text-sm text-slate-500 dark:text-slate-300">Latency</div>
                <div className="mt-2 font-semibold">Ultra low (WebRTC)</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-white/5">
                <div className="text-sm text-slate-500 dark:text-slate-300">Privacy</div>
                <div className="mt-2 font-semibold">Peer-to-peer media</div>
              </div>
            </div> */}

            <div className="mt-8">
              <div className="bg-gradient-to-r from-indigo-500 to-pink-500 p-1 rounded-xl">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="col-span-2 p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent outline-none text-slate-900 dark:text-slate-100"
                  />
                  <button
                    onClick={create}
                    className="w-full sm:w-auto justify-center px-5 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow"
                  >
                    Create Meeting
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  placeholder="Enter Room ID to join"
                  className="col-span-2 p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-white/5 outline-none text-slate-900 dark:text-slate-100"
                />
                <button
                  onClick={join}
                  className="px-5 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow"
                >
                  Join
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Tip: To invite others, share the room ID or the full URL after creating a meeting.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Illustration / feature cards */}
      <div className="flex items-center justify-center p-6 bg-white dark:bg-slate-900">
        <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-xl p-6 lg:p-10 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-rose-400 to-amber-400 flex items-center justify-center shadow">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Start meetings in seconds</h3>
                <p className="text-sm text-slate-500 dark:text-slate-300">No signup required — just a name and you're in.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <Feature title="HD Video & Audio" desc="Crystal clear meetings with adaptive quality." />
              <Feature title="Screen Sharing" desc="Share your screen with a click — great for demos." />
              <Feature title="Realtime Chat" desc="Text chat alongside video for quick links and notes." />
            </div>
          </div>

          <div className="mt-8">
            <div className="rounded-xl p-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border border-white/5">
              <div className="text-sm text-slate-400">Ready to present?</div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Use CamMeet for demos</div>
                  <div className="text-xs text-slate-400">Works on desktop & mobile (browsers permitting).</div>
                </div>
                <div>
                  <button onClick={create} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Start Now</button>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-400">Built with React, Socket.IO, and WebRTC — no 3rd party meeting service.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Feature small component */
function Feature({ title, desc }) {
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg bg-white/60 dark:bg-slate-800 border border-white/5">
      <div className="w-10 h-10 rounded-md bg-indigo-500 text-white flex items-center justify-center">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div>
        <div className="font-medium text-slate-900 dark:text-white">{title}</div>
        <div className="text-sm text-slate-500 dark:text-slate-300">{desc}</div>
      </div>
    </div>
  );
}
