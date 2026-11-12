import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { useAuth } from './lib/auth';

const Login = lazy(() => import('./pages/Login'));
const NoAccess = lazy(() => import('./pages/NoAccess'));
const Overview = lazy(() => import('./pages/Overview'));
const Posts = lazy(() => import('./pages/Posts'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const Compare = lazy(() => import('./pages/Compare'));
const Sync = lazy(() => import('./pages/Sync'));

export default function App() {
  const { status } = useAuth();
  return (
    <Suspense fallback={<div className="px-6"><Loading /></div>}>
      {status === 'loading' && <div className="px-6"><Loading /></div>}
      {status === 'signedOut' && <Login />}
      {status === 'noAccess' && <NoAccess />}
      {status === 'ready' && (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="posts" element={<Posts />} />
            <Route path="posts/:id" element={<PostDetail />} />
            <Route path="compare" element={<Compare />} />
            <Route path="sync" element={<Sync />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </Suspense>
  );
}
