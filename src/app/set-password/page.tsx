'use client'
// import { useState } from 'react';
// import { useRouter } from 'next/router';
// // import { supabase } from '../lib/supabaseClient'; // Make sure you have your supabase client
// // import { createSupabaseServerComponentClient } from "@/lib/supabaseAppRouterClient";

// const  SetPasswordPage = () => {
//   // const supbase = createSupabaseServerComponentClient();


//   const [password, setPassword] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const router = useRouter();

//   const handlePasswordSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);

//     // Get the access token from the query string
//     const { access_token } = router.query;

//     if (!access_token) {
//       setError('Missing access token');
//       setLoading(false);
//       return;
//     }

//     // Reset password
//     // const { error } = await supbase.auth.updateUser({
//     //   password,
//     // });

//     // if (error) {
//     //   setError(error.message);
//     // } else {
//     //   // Redirect user after successful password reset
//     //   router.push('/login'); // Or any page you'd like to redirect them to
//     // }
//     try {
//       // Send the password update request to the server
//       const response = await fetch('/api/set-password', {
//         method: 'POST',
//         body: JSON.stringify({ password, access_token }),
//         headers: { 'Content-Type': 'application/json' },
//       });

//       const data = await response.json();
//       if (response.ok) {
//         // Redirect user after successful password reset
//         router.push('/login');
//       } else {
//         setError(data.error);
//       }
//     } catch (err) {
//       setError('Something went wrong, please try again later');
//     } finally {
//       setLoading(false);
//     }
//   };
//     // setLoading(false);
//   };

//   return (
//     <div className="container">
//       <h1>Set Your Password</h1>
//       <form onSubmit={handlePasswordSubmit}>
//         <input
//           type="password"
//           placeholder="New Password"
//           value={pass}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//         />
//         <button type="submit" disabled={loading}>
//           {loading ? 'Setting password...' : 'Set Password'}
//         </button>
//         {error && <p className="error">{error}</p>}
//       </form>
//     </div>
//   );
// };

// export default SetPasswordPage;
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SetPasswordPage = () => {
  // const router = useRouter();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Get the access token from the query string
    // const { access_token } = router.query;

    // if (!access_token) {
    //   setError('Missing access token');
    //   setLoading(false);
    //   return;
    // }

    try {
      // Send the password update request to the server
      const response = await fetch('/api/set-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok) {
        // Redirect user after successful password reset
        router.push('/login');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Something went wrong, please try again later');
    } finally {
      setLoading(false);
    }
  };

  console.log("this is from the set-password page ")
  return (
    <div className="container">
      <h1>Set Your Password</h1>
      <form onSubmit={handlePasswordSubmit}>
        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Setting password...' : 'Set Password'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};

export default SetPasswordPage;
