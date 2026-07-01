type ProductMediaGalleryProps = {
  product: {
    nome?: string | null
    imagem_url?: string | null
    image_urls?: string[] | null
    video_url?: string | null
  }
  className?: string
}

export default function ProductMediaGallery({ product, className = '' }: ProductMediaGalleryProps) {
  const images = Array.isArray(product.image_urls)
    ? product.image_urls.filter(Boolean).slice(0, 4)
    : product.imagem_url
      ? [product.imagem_url]
      : []

  return (
    <div className={className}>
      {product.video_url ? (
        <video src={product.video_url} controls muted className="aspect-video w-full rounded-[1.5rem] object-cover" />
      ) : images[0] ? (
        <img src={images[0]} alt={product.nome || 'Produto'} className="aspect-video w-full rounded-[1.5rem] object-cover" />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-[1.5rem] bg-slate-100 text-sm font-black text-slate-400">
          Sem mídia
        </div>
      )}

      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {images.map((image) => (
            <img key={image} src={image} alt={product.nome || 'Produto'} className="h-20 rounded-xl object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  )
}
