/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { DownloadProvider } from './context/DownloadContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnimeAmbientBackground } from './components/AnimeAmbientBackground';
import { WelcomeAuthGate } from './components/WelcomeAuthGate';
import { Header } from './components/Header';
import { MobileTabNav } from './components/MobileTabNav';
import { BackButton } from './components/BackButton';
import { Footer } from './components/Footer';
import { FloatingAiAssistant } from './components/FloatingAiAssistant';
import { FeedbackToast } from './components/FeedbackToast';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { AnimeDetailPage } from './pages/AnimeDetailPage';
import { CharacterDetailPage, CharactersPage } from './pages/CharactersPage';
import { WallpaperDetailPage, WallpapersPage } from './pages/WallpapersPage';
import { Model3DDetailPage, World3DPage } from './pages/World3DPage';
import { AnimationDetailPage, AnimationsPage } from './pages/AnimationsPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { CommunityPage, CreatorProfilePage } from './pages/CommunityPages';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages';
import {
  AccountSettingsPage,
  CollectionsPage,
  DashboardPage,
  FavoritesPage,
  NotificationsPage,
  ProfilePage,
} from './pages/UserPages';
import { DownloadsPage } from './pages/DownloadsPage';
import { PrivacySettingsPage } from './pages/PrivacySettingsPage';
import { WorkspaceHubPage } from './pages/WorkspaceHubPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import {
  AboutPage,
  ContactPage,
  CopyrightPage,
  FaqPage,
  FeedbackPage,
  NotFoundPage,
  PrivacyPage,
  TermsPage,
} from './pages/SupportAndLegalPages';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function AnimatedPageRoutes() {
  const location = useLocation();
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<DiscoverPage defaultCategory="trending" pageTitle="Explore Global Anime Catalog" />} />
        <Route path="/anime/:id" element={<AnimeDetailPage />} />
        <Route path="/trending" element={<DiscoverPage defaultCategory="trending" pageTitle="Trending Anime" />} />
        <Route path="/popular" element={<DiscoverPage defaultCategory="popular" pageTitle="Most Popular Anime" />} />
        <Route path="/upcoming" element={<DiscoverPage defaultCategory="upcoming" pageTitle="Upcoming Anime" />} />
        <Route path="/seasonal" element={<DiscoverPage defaultCategory="seasonal" pageTitle="Seasonal Anime" />} />
        <Route path="/characters" element={<CharactersPage />} />
        <Route path="/characters/:id" element={<CharacterDetailPage />} />
        <Route path="/wallpapers" element={<WallpapersPage />} />
        <Route path="/wallpapers/:id" element={<WallpaperDetailPage />} />
        <Route path="/3d-world" element={<World3DPage />} />
        <Route path="/3d-world/:id" element={<Model3DDetailPage />} />
        <Route path="/animations" element={<AnimationsPage />} />
        <Route path="/animations/:id" element={<AnimationDetailPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="/workspace" element={<WorkspaceHubPage />} />
        <Route path="/ai-assistant" element={<AiAssistantPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/creators/:username" element={<CreatorProfilePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/privacy-settings" element={<PrivacySettingsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/copyright" element={<CopyrightPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </motion.div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <DownloadProvider>
            <BrowserRouter>
              <ScrollToTop />
              <div className="relative min-h-screen bg-[var(--aw-bg)] text-[var(--aw-text)] transition-colors duration-300 pb-14 md:pb-0">
                <AnimeAmbientBackground />
                <WelcomeAuthGate />

                <div className="relative z-10 flex min-h-screen flex-col">
                  <Header />
                  <main className="flex-1">
                    <BackButton />
                    <AnimatedPageRoutes />
                  </main>
                  <Footer />
                </div>

                <MobileTabNav />
                <FloatingAiAssistant />
                <FeedbackToast />
              </div>
            </BrowserRouter>
          </DownloadProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
