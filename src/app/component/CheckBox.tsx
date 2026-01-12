// Checkbox.js
'use client'
// import React from 'react';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { setTotalProject, setLeftHours, setEmployeesStatus } from '@/redux/slice';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}


const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange }) => {
  const dispatch = useDispatch<AppDispatch>();

  // dispatch(setEmployeesStatus(label))

  return (
    <label className="flex items-center space-x-3">
      <span className="text-white">{label}</span>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={onChange}
        className="h-4 w-4 text-white border-gray-300 rounded focus:ring-blue-500"
      />
    </label>
  );
};

export default Checkbox;
