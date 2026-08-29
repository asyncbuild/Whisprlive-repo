import React from 'react';

export default function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="loading-box">
      <div className="spinner-ring" />
      <p className="mono">{text}</p>
    </div>
  );
}
