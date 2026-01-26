import React from "react";

interface MemberCheckProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const MemberCheck = ({ className, ...props }: MemberCheckProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 98.24 98.47"
      className={className}
      fill="currentColor"
      {...props}
    >
      <title>Asset 2</title>
      <g id="Layer_2" data-name="Layer 2">
        <g id="Layer_1-2" data-name="Layer 1">
          <path d="M49.12,38.5a10.69,10.69,0,0,1,10.2,7.55H98.24A49.22,49.22,0,0,0,0,46.05H38.92a10.7,10.7,0,0,1,10.2-7.55" />
          <path d="M49.12,98.47A49,49,0,0,0,71.8,92.93H26.44a49,49,0,0,0,22.68,5.54" />
          <path d="M10.86,80.2H87.38A49.33,49.33,0,0,0,93,71.59H5.26a49.27,49.27,0,0,0,5.6,8.61" />
          <path d="M59.32,52.41a10.66,10.66,0,0,1-20.39,0H0A49.19,49.19,0,0,0,1.58,62H96.66a49.11,49.11,0,0,0,1.58-9.64Z" />
        </g>
      </g>
    </svg>
  );
};
