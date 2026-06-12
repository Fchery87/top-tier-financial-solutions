import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Generate the image
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: 24,
          background: 'transparent',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="92" height="92" rx="24" fill="#0B0F14" stroke="#34D399" strokeOpacity="0.5" strokeWidth="2" />
          <rect x="26" y="52" width="13" height="22" rx="3" fill="#E2E8F0" fillOpacity="0.6" />
          <rect x="42" y="40" width="13" height="34" rx="3" fill="#E2E8F0" fillOpacity="0.8" />
          <rect x="58" y="22" width="13" height="52" rx="3" fill="#10B981" />
          <circle cx="64.5" cy="17" r="4.5" fill="#34D399" />
        </svg>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}
