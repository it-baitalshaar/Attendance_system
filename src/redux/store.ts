// 'use client'
// import {configureStore} from '@reduxjs/toolkit'
// import slice from './slice';


// export const store = configureStore({
//     reducer: {
//         project: slice
//     },
// });


// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;
'use client';

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import slice from './slice';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web

// Create the persist config for the 'project' slice
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['department'], // Only persist the department field
};

// Combine reducers
const rootReducer = combineReducers({
  project: persistReducer(persistConfig, slice), // Wrap your slice reducer with persistReducer
});

// Configure the store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store); // Create the persistor

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
