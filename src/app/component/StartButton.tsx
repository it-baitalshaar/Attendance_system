
'use client'
import React, { useState } from 'react';
import axios from 'axios';

const StartButton = () => {
  const [showOptions, setShowOptions] = useState(false);

const handleButtonClick = () => {
  setShowOptions(!showOptions);
};

  const showLoginForm = async () => {
    axios.get('https://bait-alshaar-api.onrender.com/atten/test')
    .then(resp => {
      console.log(resp);
    }).catch(err => {
      console.log(err)
    })
  };

  // const showTempLogoutForm = () => {
  //   alert('Show temporary logout form');
  // };

  // const showLogoutForm = () => {
  //   alert('Show logout form');
  // };

  return (
    <div className='mt-[8rem]'>
        <div>
          <div className="w-[200px] p-2 rounded-lg text-white bg-[#e03b3b] text-center mb-5 cursor-pointer" onClick={showLoginForm}>تسجيل الدخول</div>
          {/* <div className="w-[200px] p-2 rounded-lg text-white bg-[#e03b3b] text-center mb-5 cursor-pointer" onClick={showTempLogoutForm}>تسجيل خروج موقت</div> */}
          {/* <div className="w-[200px] p-2 rounded-lg text-white bg-[#e03b3b] text-center cursor-pointer" onClick={showLogoutForm}>تسجيل الخروج</div> */}
        </div>
    </div>
  );
};

export default StartButton;
