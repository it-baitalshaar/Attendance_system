// components/TimeDisplay.js
'use client'
import React, { useEffect, useState } from 'react';

const TimeDisplay = () => {
  const [time, setTime] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {

    setIsMounted(true);
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Cleanup the interval on component unmount
    return () => clearInterval(timerId);
  }, []);
  
  if (!isMounted) {
    return null;
  }
  return (
    <div id="timeDisplay" className="flex flex-col items-center">
        <div className='mb-2'>
            <h1 className='font-bold text-[2rem]'>
            : الوقت الحالي 
            </h1>
        </div>
        <div>
            {time.toLocaleTimeString('en-US')}
        </div>
    </div>
  );
};

export default TimeDisplay;
