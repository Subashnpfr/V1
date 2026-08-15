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

  const className = [
    'dropzone',
    isDragActive ? 'active' : '',
    selectedFile ? 'ready' : ''
  ].join(' ').trim();

  return (
    <div {...getRootProps()} className={className} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input {...getInputProps()} />
      {selectedFile ? (
        <>
          <div className="dropzone-icon" style={{ color: 'var(--success)' }}>
            <CheckCircle size={28} />
          </div>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
              {selectedFile.name}
            </p>
            <p style={{ fontSize: '13px', marginTop: '0.25rem' }}>
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to transcribe
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="dropzone-icon">
            {isDragActive ? <UploadCloud size={28} /> : <FileVideo size={28} />}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
              {isDragActive ? 'Drop your file here' : 'Drag & drop video or audio'}
            </p>
            <p style={{ fontSize: '13px', marginTop: '0.25rem' }}>
              MP4, MOV, MKV, WEBM, MP3, WAV
            </p>
          </div>
          <button type="button" className="btn-secondary" disabled={disabled}>
            Browse files
          </button>
        </>
      )}
    </div>
  );
}
