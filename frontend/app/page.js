'use client'

import { useState } from 'react'
import axios from 'axios'

export default function Home() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/transcribe',
        formData,
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'captions.srt')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      alert('Error generating captions')
    }

    setLoading(false)
  }

  return (
    <main className="container">
      <h1>V1 Auto Captions</h1>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Processing...' : 'Generate Captions'}
      </button>
    </main>
  )
}