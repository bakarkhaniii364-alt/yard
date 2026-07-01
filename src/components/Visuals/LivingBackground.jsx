import React, { useState, useEffect } from 'react';

export function LivingBackground({ weather }) {
  const [elements, setElements] = useState([]);
  
  const generateLightningPath = () => {
    let path = `M 100 0`;
    let currentX = 100;
    for (let y = 20; y <= 300; y += 30) {
      currentX += (Math.random() - 0.5) * 80;
      path += ` L ${currentX} ${y}`;
    }
    return path;
  };

  useEffect(() => {
    setElements([]);
    const timer = setTimeout(() => {
      const newElements = [];
      const count = weather === 'rain' ? 30 : weather === 'storm' ? 45 : weather === 'snow' ? 20 : weather === 'clouds' ? 4 : weather === 'clear' ? 15 : 0;
      for (let i = 0; i < count; i++) {
        if (weather === 'rain') newElements.push({ id: i, type: 'rain', left: Math.random() * 100, delay: Math.random() * 2, duration: 0.5 + Math.random() * 0.5 });
        else if (weather === 'storm') newElements.push({ id: i, type: 'storm', left: Math.random() * 120, delay: Math.random() * 1.5, duration: 0.3 + Math.random() * 0.3 });
        else if (weather === 'snow') newElements.push({ id: i, type: 'snow', left: Math.random() * 100, delay: Math.random() * 5, duration: 3 + Math.random() * 3, size: 2 + Math.random() * 4 });
        else if (weather === 'clouds') newElements.push({ id: i, type: 'cloud', top: Math.random() * 100, delay: Math.random() * 20, duration: 30 + Math.random() * 20, size: 200 + Math.random() * 300 });
        else if (weather === 'clear') newElements.push({ id: i, type: 'star', left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 5, duration: 2 + Math.random() * 3, size: 2 + Math.random() * 3 });
      }
      if (weather === 'thunder' || weather === 'storm') {
         newElements.push({ id: 'bolt1', type: 'lightning', left: 10 + Math.random() * 80, delay: 0, duration: 4 + Math.random() * 3, path: generateLightningPath() });
         newElements.push({ id: 'bolt2', type: 'lightning', left: 10 + Math.random() * 80, delay: 2, duration: 5 + Math.random() * 2, path: generateLightningPath() });
      }
      setElements(newElements);
    }, 100);
    return () => clearTimeout(timer);
  }, [weather]);

  return (
    <div className="weather-layer">
      {elements.map(e => {
        if (e.type === 'rain') return <div key={e.id} className="rain-drop" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }} />
        if (e.type === 'storm') return <div key={e.id} className="storm-drop" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }} />
        if (e.type === 'snow') return <div key={e.id} className="snow-flake" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size }} />
        if (e.type === 'cloud') return <div key={e.id} className="cloud-vessel rounded-full" style={{ top: `${e.top}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size / 2 }} />
        if (e.type === 'star') return <div key={e.id} className="star-particle" style={{ left: `${e.left}%`, top: `${e.top}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size }} />
        if (e.type === 'lightning') return <svg key={e.id} className="svg-lightning" viewBox="0 0 200 300" style={{ left: `${e.left}%`, width: '200px', height: '300px', animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }}><path d={e.path} /></svg>
        return null;
      })}
    </div>
  );
}
