import React, { useRef, useEffect, useState } from "react";
import Cropper from "cropperjs";

interface ImageCropperProps {
  src: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  src,
  onCropComplete,
  onCancel,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [cropper, setCropper] = useState<Cropper | null>(null);

  useEffect(() => {
    if (imageRef.current) {
      const cropperInstance = new Cropper(imageRef.current, {
        aspectRatio: 3 / 4, // Aspect ratio for main visual
        viewMode: 1,
        dragMode: "move",
        background: false,
        autoCropArea: 0.9,
        responsive: true,
        movable: true,
        zoomable: true,
      });
      setCropper(cropperInstance);

      return () => {
        cropperInstance.destroy();
      };
    }
  }, [src]);

  const handleCrop = () => {
    if (cropper) {
      const croppedCanvas = cropper.getCroppedCanvas({
        width: 750, // Define output width for consistency
        imageSmoothingQuality: "high",
      });
      if (croppedCanvas) {
        onCropComplete(croppedCanvas.toDataURL("image/jpeg", 0.9));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col">
        <h2 className="text-lg font-bold p-4 border-b">画像を切り抜く</h2>
        <div className="p-4 flex-grow h-[60vh] max-h-[60vh] flex justify-center items-center bg-slate-100">
          <img
            ref={imageRef}
            src={src}
            alt="Cropping preview"
            style={{ display: "block", maxWidth: "100%", maxHeight: "100%" }}
            crossOrigin="anonymous"
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-slate-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-200 rounded-md"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="px-4 py-2 bg-slate-800 text-white rounded-md"
          >
            切り抜く
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
