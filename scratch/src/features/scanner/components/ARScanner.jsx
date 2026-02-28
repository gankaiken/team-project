import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Camera, CheckCircle2, ShieldCheck, Upload } from 'lucide-react';
import { useCamera } from '../../../shared/hooks/useCamera';
import { analyzeScreeningImage } from '../api/screeningApi';

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const ARScanner = ({ onComplete }) => {
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);

    const [scanMode, setScanMode] = useState('gate');
    const [selectedImage, setSelectedImage] = useState(null);
    const [validationError, setValidationError] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const { stream, error: cameraError } = useCamera(scanMode === 'camera');

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        return () => {
            if (selectedImage?.previewUrl) {
                URL.revokeObjectURL(selectedImage.previewUrl);
            }
        };
    }, [selectedImage]);

    const openFilePicker = () => {
        setValidationError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const validateFile = (file) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return 'Unsupported file type. Please upload a JPEG or PNG image.';
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return 'File is too large. Maximum size is 5MB.';
        }

        return '';
    };

    const setImageFromFile = (file, source) => {
        const errorMessage = validateFile(file);
        if (errorMessage) {
            setValidationError(errorMessage);
            return;
        }

        setValidationError('');

        if (selectedImage?.previewUrl) {
            URL.revokeObjectURL(selectedImage.previewUrl);
        }

        setSelectedImage({
            file,
            source,
            previewUrl: URL.createObjectURL(file),
        });
    };

    const handleUploadChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setImageFromFile(file, 'upload');
    };

    const handleCapture = () => {
        const videoElement = videoRef.current;
        if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
            setValidationError('Camera is still initializing. Please try again in a moment.');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        const context = canvas.getContext('2d');
        if (!context) {
            setValidationError('Unable to capture image. Please try again.');
            return;
        }

        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    setValidationError('Capture failed. Please retake the photo.');
                    return;
                }

                const capturedFile = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                setImageFromFile(capturedFile, 'camera');
            },
            'image/jpeg',
            0.92
        );
    };

    const handleContinue = async () => {
        if (!selectedImage?.file) return;

        setValidationError('');
        setIsAnalyzing(true);

        try {
            const imageAnalysis = await analyzeScreeningImage(selectedImage.file);
            onComplete({
                imageAnalysis,
                captureSource: selectedImage.source
            });
        } catch (error) {
            setValidationError('Unable to analyze this image right now. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <motion.div
            layoutId="screen-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full w-full p-6 relative"
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleUploadChange}
            />

            <div className="max-w-3xl w-full mx-auto glass-panel border border-[var(--color-cyber-teal)]/30 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between gap-3 mb-5">
                    <h2 className="text-lg md:text-xl font-semibold tracking-wide text-white">Before You Capture</h2>
                    <span className="text-[10px] uppercase tracking-widest text-[var(--color-cyber-teal)]">Required Every Scan</span>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <h3 className="text-sm font-semibold text-white mb-3">Photo Quality Tips</h3>
                        <ul className="text-xs text-gray-300 space-y-2 leading-relaxed">
                            <li>Use good lighting (natural light or bright indoor lighting).</li>
                            <li>Hold the camera steady to avoid blur.</li>
                            <li>Include the entire lesion and surrounding skin.</li>
                            <li>Add a coin or ruler for size reference.</li>
                        </ul>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-[var(--color-bio-green)]" /> Privacy & Security
                        </h3>
                        <ul className="text-xs text-gray-300 space-y-2 leading-relaxed">
                            <li>Your data is encrypted in transit and at rest.</li>
                            <li>Only authorized clinical users can access case images.</li>
                            <li>All image access is logged for security monitoring.</li>
                        </ul>
                    </div>
                </div>

                <p className="mt-5 text-[11px] text-gray-400">Accepted formats: JPEG, PNG. Maximum file size: 5MB.</p>

                {validationError && (
                    <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-center gap-2">
                        <AlertTriangle size={14} /> {validationError}
                    </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                    <button
                        onClick={() => {
                            setValidationError('');
                            setScanMode('camera');
                        }}
                        className="px-4 py-3 rounded-xl bg-[var(--color-cyber-teal)]/20 border border-[var(--color-cyber-teal)]/40 text-white text-sm font-medium hover:bg-[var(--color-cyber-teal)]/30 transition-colors flex items-center gap-2"
                    >
                        <Camera size={16} /> Capture with Camera
                    </button>
                    <button
                        onClick={openFilePicker}
                        className="px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                        <Upload size={16} /> Upload Image
                    </button>
                </div>

                {scanMode === 'camera' && (
                    <div className="mt-5 rounded-xl overflow-hidden border border-white/10 bg-black/50">
                        {cameraError ? (
                            <div className="p-4 text-sm text-red-200 flex items-start gap-2">
                                <AlertTriangle size={16} className="mt-0.5" />
                                <span>Camera access is unavailable. You can upload a JPEG or PNG file instead.</span>
                            </div>
                        ) : (
                            <>
                                <div className="relative aspect-video bg-black">
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                </div>
                                <div className="p-3 flex flex-wrap gap-2 border-t border-white/10">
                                    <button
                                        onClick={handleCapture}
                                        className="px-4 py-2 rounded-lg bg-[var(--color-bio-green)]/20 border border-[var(--color-bio-green)]/50 text-[var(--color-bio-green)] text-sm font-medium hover:bg-[var(--color-bio-green)]/30 transition-colors"
                                    >
                                        Capture Photo
                                    </button>
                                    <button
                                        onClick={openFilePicker}
                                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                                    >
                                        Upload Instead
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {selectedImage && (
                    <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-center gap-2 text-xs text-[var(--color-bio-green)] mb-3">
                            <CheckCircle2 size={14} />
                            Valid image ready ({selectedImage.source === 'camera' ? 'camera capture' : 'uploaded file'})
                        </div>
                        <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 max-h-72">
                            <img src={selectedImage.previewUrl} alt="Selected scan" className="w-full h-full object-contain" />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={openFilePicker}
                                className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                            >
                                Replace Image
                            </button>
                            {scanMode !== 'camera' && (
                                <button
                                    onClick={() => {
                                        setValidationError('');
                                        setScanMode('camera');
                                    }}
                                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Use Camera Instead
                                </button>
                            )}
                            <button
                                onClick={handleContinue}
                                disabled={!selectedImage || isAnalyzing}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--color-cyber-teal)]/80 to-blue-600/80 border border-white/10 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Continue to Analysis'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ==========================================
// 4. COPILOT CHAT SCREEN
// ==========================================
