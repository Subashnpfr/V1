'use client';

import React from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileVideo, CheckCircle } from 'lucide-react';

export default function UploadZone({ onFileSelect, selectedFile, disabled }) {
  const onDrop = (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.wmv', '.m4v', '.3gp'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']
    },
    multiple: false,
    disabled
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${isDragActive ? '#3b82f6' : selectedFile ? '#22c55e' : '#334155'}`,
        backgroundColor: isDragActive
          ? 'rgba(59, 130, 246, 0.08)'
          : selectedFile
          ? 'rgba(34, 197, 94, 0.05)'
          : '#0f172a',
        borderRadius: '16px',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem'
      }}
    >
      <input {...getInputProps()} />
      {selectedFile ? (
        <>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4ade80'
          }}>
            <CheckCircle size={32} />
          </div>
          <div>
            <p style={{ fontWeight: '600', color: '#f8fafc', fontSize: '1.1rem' }}>
              {selectedFile.name}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to Upload
            </p>
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: isDragActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(51, 65, 85, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDragActive ? '#60a5fa' : '#94a3b8'
          }}>
            {isDragActive ? <UploadCloud size={32} /> : <FileVideo size={32} />}
          </div>
          <div>
            <p style={{ fontWeight: '600', color: '#f8fafc', fontSize: '1.1rem' }}>
              {isDragActive ? 'Drop your video here...' : 'Drag & drop your video here'}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Supports MP4, MOV, MKV, or WEBM files
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
          >
            Browse Computer
          </button>
        </>
      )}
    </div>
  );
}
