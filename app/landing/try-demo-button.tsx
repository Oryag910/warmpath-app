import { buttonVariants } from '@/components/ui/button'

// "Try the demo" → GET /demo clones the seeded network into a fresh sandbox (a few seconds).
// The browser keeps this page on screen until the redirect lands, so the button itself carries
// the loading state. The state is toggled by a tiny inline listener (a class on <html>) rather
// than React state so it shows from the first paint, before hydration, and survives bfcache.
const LOADING_CLASS = 'demo-loading'

const INLINE_LISTENER = `(function(){var a=document.querySelector('#try-demo a[href="/demo"]');if(!a)return;a.addEventListener('click',function(){document.documentElement.classList.add('${LOADING_CLASS}')});window.addEventListener('pageshow',function(e){if(e.persisted)document.documentElement.classList.remove('${LOADING_CLASS}')})})();`

export default function TryDemoButton() {
  return (
    <div id="try-demo" className="flex flex-col items-center gap-2" aria-live="polite">
      <a
        href="/demo"
        className={buttonVariants({
          size: 'lg',
          className: 'h-11 px-6 text-base [.demo-loading_&]:pointer-events-none [.demo-loading_&]:opacity-80',
        })}
      >
        <span className="[.demo-loading_&]:hidden">Try the demo</span>
        <span className="hidden [.demo-loading_&]:inline-flex items-center gap-2">
          <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          Preparing your demo network…
        </span>
      </a>
      <p className="text-xs text-muted-foreground [.demo-loading_&]:hidden">
        No sign-up. Opens a sandbox with a fictional candidate and a synthetic 1,100-connection network.
      </p>
      <p className="hidden text-xs text-muted-foreground [.demo-loading_&]:block">
        Cloning 1,100 synthetic connections and their ranked paths into a private sandbox. This takes a few seconds.
      </p>
      <script dangerouslySetInnerHTML={{ __html: INLINE_LISTENER }} />
    </div>
  )
}
