interface Props {
  onClose: () => void
}

export default function ZhaozhouParticleVideo({ onClose }: Props) {
  return (
    <div className="zhaozhou-particle-overlay">
      <video
        className="zhaozhou-particle-video"
        src="images/赵州桥粒子旋转透明背景3.webm"
        autoPlay
        loop
        muted
        playsInline
      />
      <button className="zhaozhou-particle-close" onClick={onClose}>×</button>
    </div>
  )
}
