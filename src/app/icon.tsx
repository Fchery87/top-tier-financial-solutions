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
        <svg width="32" height="32" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M64 7 105 24.25v30.1c0 27.6-16.15 50.45-41 66.65-24.85-16.2-41-39.05-41-66.65v-30.1L64 7Z"
            fill="#080A0F"
            stroke="#C6A96C"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path d="M37 35h54v10H69v50H59V45H37V35Z" fill="#F8F3E8" />
          <path d="M42 61h44v9H69v25H59V70H42V61Z" fill="#C6A96C" />
          <path d="M38 92h52v8H38v-8Z" fill="#C6A96C" />
        </svg>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}
