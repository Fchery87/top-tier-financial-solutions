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
        <svg
          width="32"
          height="32"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
            fill="#C6A87C"
            fillOpacity="0.2"
            stroke="#C6A87C"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M24 11V37M13 17L24 11L35 17M13 25L24 31L35 25"
            stroke="#C6A87C"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="11" r="2" fill="#C6A87C" />
          <circle cx="13" cy="17" r="2" fill="#C6A87C" />
          <circle cx="35" cy="17" r="2" fill="#C6A87C" />
        </svg>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}
