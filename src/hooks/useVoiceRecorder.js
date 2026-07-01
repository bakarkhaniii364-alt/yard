import { useState, useRef } from 'react';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const [voiceBase64, setVoiceBase64] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const voiceExtensionRef = useRef('webm');

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']
        .find(type => MediaRecorder.isTypeSupported(type)) || '';
      
      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType }) 
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : 'ogg';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const durationSecs = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setVoiceBase64(reader.result);
          if (durationSecs >= 1) { 
            setVoicePreview(durationSecs); 
            setVoicePreviewUrl(audioUrl);
            voiceExtensionRef.current = extension;
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      throw err;
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current.stop();
  };

  const discardVoiceNote = () => {
    setVoicePreview(null);
    setVoicePreviewUrl(null);
    setVoiceBase64(null);
  };

  return {
    isRecording,
    recordingTime,
    voicePreview,
    voicePreviewUrl,
    voiceBase64,
    mediaRecorderRef,
    audioChunksRef,
    voiceExtensionRef,
    startRecording,
    stopRecording,
    discardVoiceNote,
    recordingStartTimeRef
  };
}
