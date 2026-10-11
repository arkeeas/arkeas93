"""Kachny (rybník s orobinci) pro řadu Příroda.
Scéna z AI vektoru je široká a nízká: stlačí se na délku WT (zvířata zúží jen o ~20 %, oko to nepozná)
a velké otvory oblohy (koule 224 mm) se vyplní dokreslenými orobinci a listy rákosu, až je největší otvor ≤ 100 mm.
Orobinec roste vždy z oceli pod sebou (bidlo / břeh), nikdy přes zvíře: zvířata mají ochrannou zónu 12 mm;
nad zvířetem se mezera přepaží obloukovým listem z orobince vedle. Kreslí se deterministicky (pevné semínko = varianta B)."""
import numpy as np, cv2
from svg_raster import rasterize

PX = 0.5
WT = 1750.0                    # délka scény (mm)
BOX_SVG = (243, 40, 744, 226)  # nad nejvyšší orobince, dole po čáru břehu (volné kaluže pod ní by byly ostrůvky)
SEED = 8
ANIM = [[1015, 1350, 1], [135, 620, 0]]   # potáplice (hlavní), kachny vlevo (na bidle + letící) – mm ve scéně

def prep_kachny(svg, H_MM=820.0):
    """vrací (maska scény bez okraje v rozlišení PX, zóna zvířat)"""
    top, bot = BOX_SVG[1], BOX_SVG[3]
    M = rasterize(svg, BOX_SVG, (H_MM / (bot - top)) / PX); h, w = M.shape
    M = cv2.resize(M.astype(np.uint8), (int(WT / PX), h), interpolation=cv2.INTER_AREA) > 0
    P = 20; F = np.ones((h + 2 * P, M.shape[1] + 2 * P), bool); F[P:-P, P:-P] = M; orig = F.copy()
    rng = np.random.default_rng(SEED); mm = lambda v: int(round(v / PX))
    # zóny zvířat (px v F): kachna na bidle, letící kachna (2 obdélníky, ať břeh vlevo od ní zůstane volný), potáplice
    BOX=np.zeros_like(F)
    for x0,y0,x1,y1 in [(290,260,760,600),(620,440,1260,1050),(860,1050,1260,1190),(2050,690,2720,1340)]:
        BOX[y0:y1,x0:x1]=True
    AV=cv2.dilate((orig&BOX).astype(np.uint8),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*mm(12)+1,)*2))>0
    SKIP=np.zeros_like(F)
    def ball(F):
        d=cv2.distanceTransform((~F).astype(np.uint8),cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
        y,x=np.unravel_index(d.argmax(),d.shape); return 2*d.max()*PX,x,y,d
    def blade(U,p0,p1,p2,w0,w1):
        ts=np.linspace(0,1,30)
        pts=[(1-t)**2*np.array(p0)+2*(1-t)*t*np.array(p1)+t*t*np.array(p2) for t in ts]
        for i in range(len(pts)-1):
            wd=max(2,int(w0+(w1-w0)*ts[i]))
            cv2.line(U,tuple(map(int,pts[i])),tuple(map(int,pts[i+1])),1,wd)
    def orobinec_list(F,xs,yb,yt,tx,ty):
        # orobinec na xs a dlouhy obloukovy list prehnuty k bodu (tx,ty)
        G=orobinec(F,xs,yb,yt,1 if tx>xs else -1)
        U=G.astype(np.uint8); L=yb-yt
        p0=(xs,yb-int(L*0.2)); p1=(xs+(tx-xs)*0.15,ty-mm(rng.uniform(70,110))); p2=(tx+np.sign(tx-xs)*mm(40),ty+mm(rng.uniform(10,50)))
        blade(U,p0,p1,p2,mm(13),mm(10)); return U>0
    def orobinec(F,x,yb,ytop,lean):
        U=F.astype(np.uint8)
        bend=lean*mm(rng.uniform(5,25))
        L=yb-ytop
        hh=mm(rng.uniform(80,110)); hw=mm(rng.uniform(20,25))
        ys=np.linspace(yb,ytop+mm(25),40); xs=x+bend*((yb-ys)/L)**2
        cv2.polylines(U,[np.stack([xs,ys],1).astype(np.int32)],False,1,mm(10))
        xh=int(xs[-1]); yh0=ytop+mm(25)
        cv2.ellipse(U,(xh,yh0+hh//2),(hw//2,hh//2),0,0,360,1,-1)
        cv2.line(U,(xh,yh0),(xh,ytop+mm(5)),1,mm(10))
        # list: od spodu sikmo do strany, lehce previslý konec
        side=-lean if rng.random()<0.7 else lean
        ya=yb-int(L*rng.uniform(0.05,0.25)); span=mm(rng.uniform(90,150))*side
        blade(U,(x,ya),(x+span*0.35,ya-L*0.55),(x+span,ya-L*rng.uniform(0.45,0.7)),mm(12),mm(10))
        return U>0
    added=0; first=None
    for it in range(40):
        b,x,y,d=ball(F|SKIP)
        if first is None: first=b
        if b<=100: break
        r=d[y,x]; placed=False
        if y>660:   # nizko ve scene: obycejny list rakosu ze zeme, jako ty puvodni vlevo
            for off in (0,-0.4,0.4,-0.8,0.8,-1.2,1.2):
                xc=int(x+off*r); yb=y+int(np.argmax(F[y:,xc]))
                if AV[yb,xc]: continue
                for lean in (-1,1):
                    U=F.astype(np.uint8); tip=(xc+lean*mm(rng.uniform(20,50)),y-mm(rng.uniform(40,80)))
                    blade(U,(xc,yb+mm(5)),(xc,(yb+tip[1])/2),tip,mm(16),mm(10)); G=U>0
                    if not (G&~F&AV).any(): F=G; placed=True; added+=1; break
                if placed: break
            if placed: continue
        for off in (0,-0.35,0.35,-0.7,0.7,-1,1):
            xc=int(x+off*r)
            col=F[y:,xc]; yb=y+int(np.argmax(col))
            yt=P+mm(rng.uniform(15,150)); yt=min(yt,y-mm(40))
            if yt<P+mm(10): yt=P+mm(10)
            if xc<P or xc>=F.shape[1]-P or AV[yb,xc] or yb-yt<mm(160): continue
            lean=1 if xc< F.shape[1]/2 else -1
            if rng.random()<0.4: lean=-lean
            G=orobinec(F,xc,yb,yt,lean)
            if (G&~F&AV).any(): G=orobinec(F,xc,yb,yt,-lean)
            if (G&~F&AV).any(): continue
            F=G; placed=True; added+=1; break
        if not placed:
            for dx in sorted(range(-mm(450),mm(451),mm(25)),key=abs):
                xs=x+dx
                if abs(dx)<mm(30) or xs<P+mm(20) or xs>=F.shape[1]-P-mm(20): continue
                yb=y+int(np.argmax(F[y:,xs]))
                if AV[yb,xs]: continue
                if yb-y<mm(80): continue
                yt=max(P+mm(15),min(y-mm(20),P+mm(rng.uniform(15,90))))
                G=orobinec_list(F,xs,yb,yt,x,y)
                if (G&~F&AV).any(): continue
                F=G; placed=True; added+=1; break
        if not placed: cv2.circle(SKIP.view(np.uint8),(x,y),int(r*0.5),1,-1)
    b,x,y,d=ball(F)
    # vyhlazení: stlačení a kreslení nechá na hranách jednopixelové zuby a clean() by z každého udělal hrbolek
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    S = cv2.morphologyEx(cv2.morphologyEx(F.astype(np.uint8), cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
    zone = AV[P:-P, P:-P].astype(np.uint8)
    return S[P:-P, P:-P] > 0, zone
