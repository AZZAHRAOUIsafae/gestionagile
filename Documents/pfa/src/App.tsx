/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/DashboardLayout';
import ClientDashboard from './pages/ClientDashboard';
import TopographerDashboard from './pages/TopographerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Chatbot from './pages/Chatbot';
import ClientChat from './pages/ClientChat';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ClientMaps from './pages/ClientMaps';
import PublicProfile from './pages/PublicProfile';
import NotificationToast from './components/NotificationToast';
import { useEffect, useState } from 'react';
import { User, Project, ProjectDocument, Notification } from './types';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { dbService } from './services/db';

import Onboarding from './pages/Onboarding';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding') === 'true';

  useEffect(() => {
    let unsubscribeNotifs: (() => void) | undefined;
    let unsubscribeProjects: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Mark user as online
        await dbService.updatePresence(firebaseUser.uid, 'online');

        // Fetch full user profile from Firestore
        const profile = await dbService.getUser(firebaseUser.uid);
        if (profile) {
          setUser(profile);
          
          const handleUnload = () => {
            dbService.updatePresence(firebaseUser.uid, 'offline');
          };
          window.addEventListener('beforeunload', handleUnload);

          // Subscribe to notifications
          unsubscribeNotifs = dbService.subscribeToNotifications(profile.id, (notifs) => {
            setNotifications(notifs);
          });

          // Subscribe to documents
          const unsubscribeDocs = dbService.subscribeToDocuments(profile.id, profile.role, (docs) => {
            setDocuments(docs);
          });

          // Subscribe to projects based on role
          unsubscribeProjects = dbService.subscribeToProjects(profile.role, profile.id, (prjs) => {
            setProjects(prjs);
          }, profile.adminEmail || profile.email);
          
          // If admin or topographer, load users (admin gets all, topo gets clients)
          if (profile.role === 'ADMIN' || profile.role === 'TOPOGRAPHER') {
            dbService.getAllUsers().then(allUsers => {
              setUsers(allUsers);
            });
          }

          // Cleanup for docs inside auth state
          const originalUnsubscribeProjects = unsubscribeProjects;
          unsubscribeProjects = () => {
            originalUnsubscribeProjects();
            unsubscribeDocs();
          };
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
        setProjects([]);
        setNotifications([]);
        if (unsubscribeNotifs) unsubscribeNotifs();
        if (unsubscribeProjects) unsubscribeProjects();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeNotifs) unsubscribeNotifs();
      if (unsubscribeProjects) unsubscribeProjects();
    };
  }, []);

  const handleLogout = async () => {
    if (user) {
      await dbService.updatePresence(user.id, 'offline');
    }
    await signOut(auth);
    setUser(null);
  };

  const banUser = async (id: string, isBanned: boolean) => {
    await dbService.banUser(id, isBanned);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned } : u));
  };

  const addProject = async (project: Omit<Project, 'id'>) => {
    await dbService.createProject(project);
  };

  if (loading) return null;

  return (
    <ThemeProvider defaultTheme="light" storageKey="datatopoguard-theme">
      <NotificationToast notifications={notifications} />
      <Router>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={!hasSeenOnboarding ? <Navigate to="/onboarding" /> : (!user ? <Login onLogin={setUser} /> : <Navigate to="/" />)} />
          <Route path="/register" element={!hasSeenOnboarding ? <Navigate to="/onboarding" /> : (!user ? <Register onRegister={setUser} /> : <Navigate to="/" />)} />
          
          <Route element={user ? <DashboardLayout user={user} notifications={notifications} onLogout={handleLogout} /> : <Navigate to={hasSeenOnboarding ? "/login" : "/onboarding"} />}>
            <Route path="/" element={
              user?.role === 'ADMIN' ? <AdminDashboard users={users} setUsers={setUsers} onBanUser={banUser} notifications={notifications} /> : 
              user?.role === 'TOPOGRAPHER' ? <TopographerDashboard projects={projects} setProjects={setProjects} clients={users.filter(u => u.role === 'CLIENT')} user={user} documents={documents} /> : 
              user && <ClientDashboard user={user} projects={projects.filter(p => p.clientId === user.id)} documents={documents} notifications={notifications} onAddProject={addProject} />
            } />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route path="/profile" element={<Settings user={user!} onUpdate={setUser} onLogout={handleLogout} />} />
            <Route path="/settings" element={<Settings user={user!} onUpdate={setUser} onLogout={handleLogout} />} />
            <Route path="/documents" element={
               user?.role === 'CLIENT' ? <ClientDashboard user={user} projects={projects.filter(p => p.clientId === user.id)} documents={documents} notifications={notifications} onAddProject={addProject} initialShowDocs={true} /> : 
               user?.role === 'ADMIN' ? <AdminDashboard users={users} setUsers={setUsers} onBanUser={banUser} notifications={notifications} initialTab="documents" /> : <Navigate to="/" />
            } />
            <Route path="/messages" element={<ClientChat user={user!} onUpdate={setUser} />} />
            <Route path="/maps" element={
              user?.role === 'CLIENT' ? <ClientMaps user={user} projects={projects.filter(p => p.clientId === user.id)} /> :
              <TopographerDashboard projects={projects} setProjects={setProjects} clients={users.filter(u => u.role === 'CLIENT')} initialTab="maps" user={user!} documents={documents} />
            } />
            <Route path="/finance" element={user?.role === 'ADMIN' ? <AdminDashboard users={users} setUsers={setUsers} onBanUser={banUser} notifications={notifications} initialTab="finance" /> : <TopographerDashboard projects={projects} setProjects={setProjects} clients={users.filter(u => u.role === 'CLIENT')} initialTab="finance" user={user!} documents={documents} />} />
            <Route path="/registry" element={user?.role === 'ADMIN' ? <AdminDashboard users={users} setUsers={setUsers} onBanUser={banUser} notifications={notifications} initialTab="registry" /> : <Navigate to="/" />} />
            <Route path="/progress" element={<TopographerDashboard projects={projects} setProjects={setProjects} clients={users.filter(u => u.role === 'CLIENT')} initialTab="projects" user={user!} documents={documents} />} />
            <Route path="/users" element={<AdminDashboard users={users} setUsers={setUsers} onBanUser={banUser} notifications={notifications} initialTab="users" />} />
            <Route path="/logs" element={<AdminDashboard users={users} setUsers={setUsers} onBanUser={banUser} notifications={notifications} initialTab="audit" />} />
            <Route path="/profile/:uid" element={<PublicProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
