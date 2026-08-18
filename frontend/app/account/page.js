'use client';

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import AuthGate from '../components/AuthGate';
import { useAuth } from '../context/AuthContext';

function AccountContent() {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    setSavingProfile(true);
    try {
      await updateProfile(name.trim());
      setProfileMsg('Profile updated.');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setProfileErr(typeof detail === 'string' ? detail : 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (newPassword !== confirmPassword) {
      setPwErr('New passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPwMsg('Password updated. Other sessions were signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPwErr(typeof detail === 'string' ? detail : 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <AppShell>
      <div className="account-page">
        <h1>Account</h1>
        <p className="auth-lead">Manage your profile and security settings.</p>

        <section className="account-section">
          <h2>Profile</h2>
          {profileErr && <div className="alert alert-error">{profileErr}</div>}
          {profileMsg && <div className="alert alert-success">{profileMsg}</div>}
          <form onSubmit={saveProfile} className="auth-form">
            <label className="field-label" htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              className="input-text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <label className="field-label" htmlFor="profile-email">Email</label>
            <input id="profile-email" className="input-text" value={user?.email || ''} disabled />
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>

        <section className="account-section">
          <h2>Security</h2>
          {pwErr && <div className="alert alert-error">{pwErr}</div>}
          {pwMsg && <div className="alert alert-success">{pwMsg}</div>}
          <form onSubmit={savePassword} className="auth-form">
            <label className="field-label" htmlFor="current-pw">Current password</label>
            <input
              id="current-pw"
              type="password"
              className="input-text"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <label className="field-label" htmlFor="new-pw">New password</label>
            <input
              id="new-pw"
              type="password"
              className="input-text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <label className="field-label" htmlFor="confirm-pw">Confirm new password</label>
            <input
              id="confirm-pw"
              type="password"
              className="input-text"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" className="btn-secondary" disabled={savingPw}>
              {savingPw ? 'Updating…' : 'Change password'}
            </button>
          </form>
        </section>

        <section className="account-section">
          <h2>Session</h2>
          <button type="button" className="btn-primary" onClick={() => logout()}>
            Log out
          </button>
        </section>
      </div>
    </AppShell>
  );
}

export default function AccountPage() {
  return (
    <AuthGate>
      <AccountContent />
    </AuthGate>
  );
}
