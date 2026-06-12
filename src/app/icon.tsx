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
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="32" height="32" rx="8" fill="#18181B" />
          <path d="M6 23 L16 9 L26 23" stroke="#FFFFFF" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M11.5 23 L16 16.5 L20.5 23" stroke="#8A90F0" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}
