#!/usr/bin/env python3
"""Render transparent, beveled-blue Marketplace icons for mod_mcp and block_mcp."""
from __future__ import annotations
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE=1024
YY,XX=np.mgrid[0:SIZE,0:SIZE].astype(np.float32)

def rr(box,r,blur=0):
    m=Image.new('L',(SIZE,SIZE),0)
    ImageDraw.Draw(m).rounded_rectangle(box,r,fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m

def grad(top,bottom,light=(.2,.05),glow=0.15):
    t=(YY/(SIZE-1))[:,:,None]
    a=np.asarray(top,dtype=np.float32); b=np.asarray(bottom,dtype=np.float32)
    p=a[None,None,:]*(1-t)+b[None,None,:]*t
    radial=np.clip(1-np.hypot((XX/SIZE-light[0])*.96,(YY/SIZE-light[1])*1.05)/1.1,0,1)
    p=p+radial[:,:,None]*(255-p)*glow
    return Image.fromarray(np.uint8(np.clip(p,0,255)),'RGB').convert('RGBA')

def add_mask(image,layer,mask):
    image.paste(layer,(0,0),mask)

def tinted_mask(image,mask,color,alpha=255):
    layer=Image.new('RGBA',(SIZE,SIZE),(*color,alpha))
    image.alpha_composite(Image.composite(layer,Image.new('RGBA',(SIZE,SIZE)),mask))

def rounded_gradient(image,box,r,top,bottom,glow=.12):
    layer=grad(top,bottom,glow=glow)
    image.paste(layer,(0,0),rr(box,r,1))

def shadow(image,mask,offset=(0,18),blur=30,alpha=95):
    s=Image.new('L',(SIZE,SIZE),0)
    s.paste(mask,offset)
    s=s.filter(ImageFilter.GaussianBlur(blur))
    layer=Image.new('RGBA',(SIZE,SIZE),(2,13,61,0))
    layer.putalpha(s.point(lambda x:int(x*alpha/255)))
    image.alpha_composite(layer)

def line(image,coords,color,width=18,joint='curve'):
    d=ImageDraw.Draw(image)
    d.line(coords,fill=color,width=width,joint=joint)
    rad=width/2
    for x,y in (coords[0],coords[-1]):
        d.ellipse((x-rad,y-rad,x+rad,y+rad),fill=color)

def circle(image,cx,cy,r,color):
    ImageDraw.Draw(image).ellipse((cx-r,cy-r,cx+r,cy+r),fill=color)

def polygon(image,points,fill):
    ImageDraw.Draw(image).polygon(points,fill=fill)

def base(variant):
    canvas=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
    rim=rr((6,6,1018,1018),226,1.15)
    shadow(canvas,rim,(0,4),13,80)
    add_mask(canvas,grad((160,253,255),(10,62,179),(.10,-.1),.22),rim)
    interior=rr((23,23,1001,1001),214,1.4)
    if variant=='mod':
        palette=((12,174,253),(24,50,199))
        tints=((25,205,255),(61,49,220))
    else:
        palette=((7,195,246),(5,85,198))
        tints=((23,247,236),(18,104,234))
    add_mask(canvas,grad(*palette,(.14,.03),.23),interior)
    curved=Image.new('L',(SIZE,SIZE),0)
    d=ImageDraw.Draw(curved)
    d.polygon([(40,315),(145,160),(320,75),(500,38),(690,35),(980,70),(1000,280),(870,245),(733,200),(600,211),(460,290),(290,370),(90,460)],fill=255)
    curved=Image.composite(curved,Image.new('L',(SIZE,SIZE),0),interior)
    tinted_mask(canvas,curved,tints[0],32)
    light=Image.new('L',(SIZE,SIZE),0)
    ImageDraw.Draw(light).ellipse((630,530,1280,1130),fill=210)
    light=Image.composite(light,Image.new('L',(SIZE,SIZE),0),interior).filter(ImageFilter.GaussianBlur(140))
    tinted_mask(canvas,light,tints[1],80)
    bevel=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
    d=ImageDraw.Draw(bevel)
    d.arc((12,11,1011,1010),180,346,fill=(217,255,255,172),width=9)
    d.arc((17,17,1006,1006),4,175,fill=(7,50,183,125),width=12)
    canvas.alpha_composite(bevel)
    return canvas

def pane(image,box,r=74,top=(250,255,255),bottom=(178,222,255),depth=16):
    x0,y0,x1,y1=box
    sh=rr((x0,y0+16,x1,y1+16),r)
    shadow(image,sh,(0,17),30,120)
    rounded_gradient(image,(x0,y0+depth,x1,y1+depth),r,(49,110,220),(11,50,139))
    rounded_gradient(image,box,r,top,bottom,glow=.035)
    border=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
    ImageDraw.Draw(border).rounded_rectangle(box,r,outline=(255,255,255,170),width=5)
    image.alpha_composite(border)

def mod_icon():
    c=base('mod')
    pane(c,(165,205,846,775),80,(250,255,255),(176,219,255),19)
    rounded_gradient(c,(198,235,812,745),54,(28,117,230),(7,25,108),.025)
    border=Image.new('RGBA',(SIZE,SIZE));d=ImageDraw.Draw(border)
    d.rounded_rectangle((200,238,810,744),52,outline=(129,212,255,206),width=7)
    c.alpha_composite(border)
    rounded_gradient(c,(203,240,809,314),49,(253,255,255),(224,242,255),.0)
    d=ImageDraw.Draw(c)
    for x,color in [(257,(25,196,244)),(295,(100,128,255)),(334,(198,142,255))]:
        d.ellipse((x-12,268,x+12,292),fill=color)
    d.rounded_rectangle((486,265,758,288),11,fill=(189,222,253))
    rounded_gradient(c,(248,358,476,593),47,(101,85,247),(28,51,182),.12)
    d=ImageDraw.Draw(c)
    d.rounded_rectangle((256,366,467,584),40,outline=(184,176,255,230),width=7)
    d.polygon([(331,420),(331,535),(420,477)],fill=(231,250,255))
    d.polygon([(343,434),(343,521),(408,477)],fill=(249,255,255))
    for y,w in [(380,225),(450,175),(526,190)]:
        d.rounded_rectangle((521,y,521+w,y+28),14,fill=(130,194,255,110))
        d.rounded_rectangle((523,y+2,523+int(w*.63),y+24),12,fill=(244,252,255,238))
    for i,x in enumerate((280,373,466,559)):
        d.rounded_rectangle((x,641,x+66,682),17,fill=(75+min(i*21,65),171+min(i*12,30),255))
    badge=rr((629,610,854,835),112)
    shadow(c,badge,(0,21),25,110)
    rounded_gradient(c,(626,602,855,831),114,(246,255,255),(152,204,246),.03)
    rounded_gradient(c,(647,623,834,810),92,(90,235,173),(3,154,123),.10)
    d=ImageDraw.Draw(c)
    d.ellipse((648,624,833,809),outline=(209,255,239),width=9)
    line(c,[(696,717),(738,758),(796,688)],(1,111,94,155),26)
    line(c,[(692,709),(735,748),(796,672)],(247,255,255),26)
    return c

def block_icon():
    c=base('block')
    pane(c,(170,213,844,783),82,(249,255,255),(172,224,249),17)
    rounded_gradient(c,(201,243,815,753),53,(26,111,222),(11,46,141),.03)
    d=ImageDraw.Draw(c)
    d.rounded_rectangle((203,245,812,751),50,outline=(120,222,255),width=7)
    d.rounded_rectangle((245,266,470,292),12,fill=(224,250,255))
    for i in range(3):
        d.ellipse((722+i*25,271,738+i*25,287),fill=(141,239,255))
    for y,w in [(624,480),(684,390)]:
        d.rounded_rectangle((248,y,248+w,y+24),12,fill=(112,201,250))
        d.rounded_rectangle((250,y+1,250+int(w*.72),y+23),11,fill=(236,250,255))
    chatshadow=rr((256,330,770,603),98)
    shadow(c,chatshadow,(0,18),29,145)
    polygon(c,[(330,577),(301,654),(435,592)],(39,43,160,255))
    rounded_gradient(c,(258,313,772,597),99,(139,109,255),(57,34,186),.06)
    polygon(c,[(323,563),(307,636),(432,581)],(65,55,198,255))
    polygon(c,[(325,555),(314,622),(426,572)],(118,100,240,255))
    border=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0));dd=ImageDraw.Draw(border)
    dd.rounded_rectangle((260,315,770,595),97,outline=(206,208,255,190),width=7)
    c.alpha_composite(border)
    line(c,[(395,455),(512,407),(639,465)],(40,26,134,170),27)
    line(c,[(396,443),(511,395),(637,453)],(232,252,255),20)
    line(c,[(398,448),(522,511),(641,462)],(28,31,116,145),26)
    line(c,[(396,437),(519,499),(639,450)],(191,247,255),16)
    for x,y,r in [(396,437,37),(512,397,43),(638,451,38),(518,499,37)]:
        circle(c,x,y+9,r+4,(21,29,132))
        circle(c,x,y,r+4,(239,255,255))
        circle(c,x,y,r-9,(50,207,242) if x!=512 else (164,137,255))
        circle(c,x-10,y-10,r/3,(216,252,255))
    return c

def main():
    dest=Path(sys.argv[1]) if len(sys.argv)>1 else Path.cwd()
    dest.mkdir(parents=True,exist_ok=True)
    for component,art in [('mod_mcp',mod_icon()),('block_mcp',block_icon())]:
        path=dest/component/'icon.png'
        path.parent.mkdir(parents=True,exist_ok=True)
        art.save(path,optimize=True)
        print(f'{component}: {path}, {art.size}, {art.mode}, {path.stat().st_size} bytes')

if __name__=='__main__':
    main()
