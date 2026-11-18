# Game character sample 01 (original design; style reference = technique only)
# Run: python3 -I build.py [norender]
import bpy, json, gzip, math, sys, os
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFilter

D = '/home/claude/ref/mpfb2/src/mpfb/data/'
OUT = '/home/claude/marla/out/'
os.makedirs(OUT + 'tex', exist_ok=True)

# ----------------------------------------------------------------- CONFIG
CONFIG = dict(
    seed=7,
    tex=2048,                      # skin texture size
    # body shape (MakeHuman CC0 targets, weight 0..1)
    targets=[('macrodetails/universal-female-young-averagemuscle-averageweight', 0.55),
             ('macrodetails/universal-female-young-averagemuscle-minweight', 0.45),
             # MARLA pass (2026-11-13): young and natural. Soft oval face, normal-size almond eyes, small nose, medium lips. No doll proportions.
             ('head/head-age-decr', 0.34), ('head/head-oval', 0.45), ('head/head-invertedtriangular', 0.22), ('head/head-fat-decr', 0.12), ('head/head-scale-horiz-decr', 0.08),
             ('forehead/forehead-scale-vert-decr', 0.30),
             ('cheek/l-cheek-volume-incr', 0.12), ('cheek/r-cheek-volume-incr', 0.12), ('cheek/l-cheek-bones-incr', 0.40), ('cheek/r-cheek-bones-incr', 0.40),
             ('chin/chin-height-decr', 0.22), ('chin/chin-width-decr', 0.42), ('chin/chin-triangle', 0.08), ('chin/chin-bones-decr', 0.25), ('chin/chin-prominent-decr', 0.10),
             ('neck/measure-neck-circ-decr', 0.5),
             ('eyes/l-eye-scale-incr', 0.46), ('eyes/r-eye-scale-incr', 0.46), ('eyes/l-eye-bag-decr', 0.6), ('eyes/r-eye-bag-decr', 0.6),
             ('eyes/l-eye-corner2-up', 0.30), ('eyes/r-eye-corner2-up', 0.30),
             ('mouth/mouth-lowerlip-volume-decr', 0.45), ('mouth/mouth-upperlip-volume-decr', 0.55), ('mouth/mouth-scale-horiz-decr', 0.15), ('mouth/mouth-cupidsbow-incr', 0.15),
             ('mouth/mouth-scale-vert-decr', 0.45), ('mouth/mouth-scale-depth-decr', 0.45), ('mouth/mouth-lowerlip-height-decr', 0.30), ('mouth/mouth-upperlip-height-decr', 0.30),
             ('nose/nose-scale-horiz-decr', 0.60), ('nose/nose-scale-vert-decr', 0.36), ('nose/nose-point-up', 0.35), ('nose/nose-volume-decr', 0.40), ('nose/nose-hump-decr', 0.30)],
    skin=(229, 199, 184), blush=(214, 134, 124), lips=(198, 130, 122), brow=(88, 68, 52), lid_shadow=((84, 58, 54), 0.42), skin_normal=0.5, sculpt=1.0, sculpt_stamps=[],      # sculpt_stamps: (x, z, radius, mm, mirrored) rows pasted from the editor's free sculpt
    grin_sculpt=dict(upper_lip=0.0042, lower_side=0.0038, lower_mid=-0.0008, lip_back=0.0012, fold=0.0009, apple=0.0028, lower_lid=0.0017, flare=0.0016),      # metres
   
    sculpt_brushes=dict(cheekbone=1.3, apple=1.0, cheek_hollow=-0.4, nasolabial=-0.2, philtrum=-0.6, lip_tubercle=0.7, lower_lip=0.9, mouth_corner=-0.7, under_lip=-0.7, chin_ball=0.8, brow_bone=0.6, tear_trough=-0.15, temple=-0.3, nose_bridge_side=-0.5, nose_tip=0.5, alar_crease=-0.5, nasion=-0.4, jaw_line=0.5),      # millimetres: + out, - in
    sculpt_detail=dict(lip_crease=0.30, lip_border=0.5, philtrum=0.4, lid_crease=0.45, under_eye=0.06, nostril=0.4, nasolabial=0.0),
    blush_cheek=0.34, blush_nose=0.36, blush_eye=0.20, freckle=0.11,
    skin_rough=0.50, lip_rough=0.42, teeth_wide=1.07, teeth_forward=0.0, teeth_drop=(0.0085, 0.005), teeth_lower_back=0.003,
    iris=(112, 130, 124), iris_r=0.27, pupil_r=0.085,
    hair_light=(238, 224, 198), hair_mid=(208, 186, 152), hair_dark=(152, 126, 98), hair_red=((226, 84, 112), (168, 44, 72)),
    hair_shell_offsets=(0.001, 0.006, 0.011), hair_cover=(1.0, 0.6, 0.35), hair_tip=(0.10, 0.30, 0.5),
    hair_rough=0.42, hair_root_w=0.55, hair_base_n=0, hair_mid_n=10, part_crease=0.002, shell_n=18, shell_lift=0.012, shell_end=1.10, fringe_a0=6, fringe_a1=62, fringe_z0=0.004, fringe_z1=-0.030, fringe_w=0.0055, hair_loose_lift=0.015, teeth_gap=0.97, teeth_arch=(0.0235, 0.021), lip_raise=0.0014, teeth_back=(0.30, 0.15, 0.14), # NATURAL SMILE study (2026-11-14, dental aesthetics rules): per upper tooth from the midline out: (width m, edge height 1 = longest, biting-edge width factor = how open the gap to the next tooth is at the edge, crown tilt toward the midline m).
             # central incisor width/length about 78%; lateral about 77% as wide and 0.8 mm shorter; canine edge near the central's level and pointed; gaps at the biting edge open up from the centre outward; crowns lean toward the midline; the edges rise toward the back (smile arc); left and right are not identical.
             teeth_set=((0.0086, 1.0, 0.88, 0.0001), (0.0066, 0.80, 0.78, 0.0003), (0.0076, 0.93, 0.50, 0.0005), (0.0070, 0.78, 0.66, 0.0004), (0.0068, 0.72, 0.66, 0.0003)), teeth_len=0.0110, teeth_arc=0.0011, teeth_asym=(0.0, 0.00025, -0.00015, 0.0002, 0.0), teeth_color=(0.90, 0.87, 0.80), smile_wide=(0.010, 0.004, 0.003), crinkle=(0.010, 0.0009, 0.60), fringe_lift=0.006, hair_front_n=7, hair_front_alpha=74, hair_clear=0.012,
    hair_width_scale=1.05, hair_wave=0.004, hair_wave_freq=1.0, hair_strand_px=2, hair_fringe_n=10, hair_fringe_side=0, hair_curve=0.16, hair_edge_thin=0.5, hair_tip_len=0.5, hair_repeat=8, hair_behind_ear_deg=10, hairline=0.066, hair_blend=0.05,
    cloth=(0.008, 0.008, 0.010), outfit=dict(jacket='#8FA67E', trousers='#4F6B3A', trim='#2F4A34', linen='#D9CDB4', leather='#8A6A47', boots='#6B4F36', pewter='#A9B0B3', solar='#5E7286'),      # outfit A: scout wrap jacket (user picked, 2026-11-14)
    hand_pose=dict(   # per finger: ((curl of joint 1, 2, 3 in radians), spread)
        l=dict(thumb=((-0.25, 0.05, 0.05), 0.0), index=((0.05, 0.12, 0.08), 0.16), middle=((0.05, 0.12, 0.08), 0.03), ring=((0.08, 0.15, 0.10), -0.10), pinky=((0.10, 0.18, 0.10), -0.24)),
        r=dict(thumb=((0.35, 0.45, 0.35), 0.0), index=((0.75, 1.05, 0.55), 0.0), middle=((1.25, 1.45, 0.75), 0.0), ring=((1.30, 1.45, 0.75), 0.0), pinky=((1.35, 1.45, 0.75), 0.0))),
    wrap_w=0.020, cuff_len=0.045, strap_w=0.030, belt=(0.105, 0.070, 0.017), cloth_margin=0.009, cloth_rough=0.9, cloth_spec=0.15, cloth_tex=True, cloth_scale=dict(twill=1.0, weave=1.0, hide=1.0),   # klad-painted fabric on the garments: weave already tiled and multiplied with the klad fold map (out/tex/cloth_*.png), so scale stays 1
     thread_rough=0.9, emb_scale=7.0, emb_strength=0.0, coat_hem=(0.06, -0.075, 0.024, 0.040),
    leather_rough=0.3, metal=(0.82, 0.83, 0.86),
    suit_offset=0.004, skirt_offset=0.010, boot_top=0.30, skirt_hem=0.50,
    # expressions: preset = {unit: weight}; units are the 34 MakeHuman expression units; -lr = both sides
    expressions={
        'anguish': {'eyebrows-lr-inner-up': 1.0, 'eyebrows-lr-down': 0.35, 'eye-lr-opened-up': 0.5, 'mouth-open': 0.22,
                    'mouth-parling': 0.5, 'mouth-depression': 0.55, 'nose-lr-elevation': 0.15},
        'grin': {'grin-upper-lip': 0.33, 'grin-lower-lip': 0.27, 'grin-lr-fold': 0.31, 'grin-lr-lid': 0.33, 'grin-lr-nose': 0.25, 'smile-lr-wide': 0.34, 'upper-lip-raise': 0.24, 'eye-lr-slit': 0.16, 'mouth-corner-puller': 0.52, 'mouth-open': 0.05, 'mouth-parling': 0.31, 'mouth-part-later': 0.18, 'nose-lr-elevation': 0.08, 'cheek-lr-raise': 0.58},      # the user's own grin from the editor, 2026-11-14 (replaces my sculpted preset; that one is in build_marla_sample12.py)
        'smile': {'eye-lr-opened-up': 0.09, 'eye-lr-slit': 0.34, 'mouth-compression': 0.1, 'mouth-corner-puller': 0.58, 'mouth-depression-retraction': 0.17, 'mouth-depression': 0.03, 'neck-platysma': 0.17, 'nose-lr-dilatation': 0.19, 'cheek-lr-raise': 0.28},      # user's recipe from the face editor, 2026-11-14
        'surprised': {'eye-lr-opened-up': 1, 'eyebrows-lr-up': 1, 'mouth-open': 0.3, 'mouth-parling': 0.3},      # user's recipe from the face editor, 2026-11-14
        'crying': {'eye-lr-slit': 0.45, 'eyebrows-lr-down': 0.44, 'eyebrows-lr-inner-up': 0.8, 'mouth-compression': 0.22, 'mouth-depression': 0.74, 'mouth-retraction': 0.16, 'neck-platysma': 0.2, 'nose-lr-elevation': 0.35, 'cheek-lr-raise': 0.6, 'eyebrows-lr-slant': 0.9, 'chin-crumple': 0.62},      # user's recipe, 2026-11-14
        'puzzled': {'eye-left-slit': 0.68, 'eye-right-slit': 0.78, 'eyebrows-left-up': 0.48, 'eyebrows-right-down': 0.5, 'mouth-depression': 0.42, 'mouth-eversion': 0.45, 'mouth-upward-retraction': 0.15, 'neck-platysma': 0.28, 'nose-left-elevation': 0.94, 'nose-right-dilatation': 0.86, 'nose-right-elevation': 1, 'eyebrows-left-slant': 0.55, 'chin-crumple': 0.26},      # user's recipe, 2026-11-14
        'smile_study': {'mouth-corner-puller': 0.78, 'smile-lr-wide': 0.06, 'cheek-lr-raise': 0.66, 'grin-lr-fold': 0.40, 'grin-lr-lid': 0.50, 'eye-lr-slit': 0.24, 'mouth-parling': 0.22, 'upper-lip-raise': 0.14, 'grin-upper-lip': 0.22, 'grin-lr-nose': 0.18},      # study sample 2026-11-14: cheek raiser + lip corner puller + lips part (the three units Zarins lists for a smile); not approved
        'smile_study3': {'mouth-corner-puller': 0.86, 'smile-lr-wide': 0.12, 'cheek-lr-raise': 0.86, 'grin-lr-fold': 0.50, 'grin-lr-lid': 0.60, 'eye-lr-slit': 0.28, 'mouth-parling': 0.40, 'upper-lip-raise': 0.22, 'grin-upper-lip': 0.30, 'grin-lower-lip': 0.30, 'mouth-depression-retraction': 0.25, 'mouth-open': 0.08, 'grin-lr-nose': 0.25, 'eyebrows-lr-down': 0.08},      # study sample from the Zarins smile page the user sent (cheek raiser + corner puller + lips part, lower lip pulled down); not approved
        'smile_study4': {'mouth-corner-puller': 0.86, 'smile-lr-wide': 0.12, 'cheek-lr-raise': 0.86, 'grin-lr-fold': 0.85, 'grin-lr-lid': 0.50, 'eye-lr-slit': 0.08, 'mouth-parling': 0.40, 'upper-lip-raise': 0.22, 'grin-upper-lip': 0.30, 'grin-lower-lip': 0.30, 'mouth-depression-retraction': 0.34, 'mouth-open': 0.08, 'grin-lr-nose': 0.25, 'eyebrows-lr-down': 0.12},      # study 3 with the eye more open, a deeper nose-to-mouth fold and the corners tucked further back; not approved
        'smile_study5': {'mouth-corner-puller': 0.92, 'smile-lr-wide': 0.45, 'cheek-lr-raise': 0.90, 'grin-lr-fold': 1.60, 'grin-lr-lid': 0.60, 'eye-lr-slit': 0.20, 'mouth-parling': 0.30, 'upper-lip-raise': 0.60, 'grin-upper-lip': 0.80, 'grin-lower-lip': 0.45, 'mouth-depression-retraction': 0.30, 'nose-lr-elevation': 0.30, 'nose-lr-dilatation': 0.50, 'grin-lr-nose': 1.20, 'eyebrows-lr-down': 0.30},      # study from measurements against the user's grin reference and the Zarins smile page: upper lip up toward the nose, wider nose and mouth, teeth filling the opening, lower brows; not approved
        'smile_study5p': {'mouth-corner-puller': 0.92, 'smile-lr-wide': 0.45, 'cheek-lr-raise': 0.90, 'grin-lr-fold': 1.60, 'grin-lr-lid': 0.60, 'eye-lr-slit': 0.20, 'mouth-parling': 0.30, 'upper-lip-raise': 0.60, 'grin-upper-lip': 0.80, 'grin-lower-lip': 0.45, 'mouth-depression-retraction': 0.30, 'nose-lr-elevation': 0.30, 'nose-lr-dilatation': 0.50, 'grin-lr-nose': 1.20, 'eyebrows-lr-down': 0.30},      # the same face, head tipped down as in the reference
        'smile_study6': {'mouth-corner-puller': 0.92, 'smile-lr-wide': 0.45, 'cheek-lr-raise': 0.95, 'grin-lr-fold': 3.00, 'grin-lr-lid': 1.20, 'eye-lr-slit': 0.04, 'mouth-parling': 0.22, 'upper-lip-raise': 0.60, 'grin-upper-lip': 2.00, 'grin-lower-lip': 0.80, 'mouth-depression-retraction': 0.30, 'nose-lr-elevation': 0.30, 'nose-lr-dilatation': 0.60, 'grin-lr-nose': 2.20, 'eyebrows-lr-down': 0.35},      # route 1 sample: Marla's own face, hand-placed grin shapes pushed past 1 (upper lip up to the nose, lower lid arc, deeper fold, wider nose); not approved
        'ict_smile': {'ict-lr-mouthSmile': 0.85, 'ict-lr-cheekSquint': 0.8, 'ict-lr-cheekRaiser': 0.7, 'ict-lr-eyeSquint': 0.5, 'ict-lr-mouthUpperUp': 0.35, 'ict-lr-mouthLowerDown': 0.3, 'ict-lr-mouthDimple': 0.2, 'ict-lr-noseSneer': 0.12, 'mouth-open': 0.06},      # study: scan-based sculpted shapes on Marla's face; not approved
        'ict_smile_closed': {'ict-lr-mouthSmile': 0.6, 'ict-lr-cheekSquint': 0.5, 'ict-lr-cheekRaiser': 0.45, 'ict-lr-eyeSquint': 0.3, 'ict-lr-mouthDimple': 0.25},
        'ict_crying': {'ict-lr-browInnerUp': 0.9, 'ict-lr-browDown': 0.45, 'ict-lr-mouthFrown': 0.7, 'ict-mouthShrugLower': 0.6, 'ict-lr-mouthPress': 0.4, 'ict-lr-mouthStretch': 0.25, 'ict-lr-eyeSquint': 0.5, 'ict-lr-cheekSquint': 0.35, 'ict-lr-noseSneer': 0.2},
        'u_slide': {'cheek-lr-slide': 1.0}, 'u_lid': {'lid-lr-arc': 1.0}, 'u_lip': {'lip-lift': 1.0},      # each new study shape alone
        'smile_study7': {'mouth-corner-puller': 0.92, 'smile-lr-wide': 0.45, 'cheek-lr-raise': 0.45, 'cheek-lr-slide': 1.0, 'lid-lr-arc': 1.0, 'lip-lift': 1.0, 'mouth-parling': 0.30, 'grin-lower-lip': 0.45, 'mouth-depression-retraction': 0.30, 'nose-lr-dilatation': 0.50, 'grin-lr-nose': 1.20, 'eyebrows-lr-down': 0.30, 'eye-lr-slit': 0.06},      # study 5 rebuilt on the new shapes; not approved
        'smile_2': {'eye-lr-opened-up': 0.74, 'eye-lr-slit': 0.18, 'eyebrows-lr-extern-up': 0.14, 'mouth-corner-puller': 0.96, 'mouth-depression-retraction': 0.36, 'mouth-eversion': 0.84, 'mouth-parling': 0.4, 'mouth-protusion': 0.06, 'neck-platysma': 0.08, 'nose-lr-elevation': 0.34, 'cheek-lr-raise': 1.02},      # user's recipe, 2026-11-14
        'smile4': {'eye-lr-closure': 0.56, 'eye-lr-slit': 0.32, 'mouth-corner-puller': 0.96, 'mouth-depression-retraction': 0.33, 'mouth-open': 0.58, 'mouth-protusion': 0.29, 'cheek-lr-raise': 1.2},      # user's recipe, 2026-11-14
        'ref2_sad': {'eye-lr-slit': 0.45, 'eyebrows-lr-down': 0.35, 'eyebrows-lr-slant': 0.35, 'mouth-depression': 0.25, 'mouth-compression': 0.1},
    },
    expr_render=['neutral', 'ict_smile', 'ict_crying', 'ict_smile_closed'],
    # hand-built extra units (metres): cheek raise, sad brow slant, chin crumple
    # study shapes 2026-11-14 (metres; not approved): cheek mass sliding up with the fold at its edge, lower-lid arc, upper-lip lift, gum band
    slide=dict(edge=0.007, r=0.021, out=0.0012, fwd=0.0035, up=0.0060, press=0.0005, bag=0.0016), lid_arc=0.0016, lip_lift=dict(up=0.0040, back=0.0008), gum_color=(0.70, 0.36, 0.38),
    # eye study 2026-11-14 (flag eyes2; not approved): layered eye, sizes in metres from measured eyes (iris 11.75 mm across, cornea radius 7.8 mm)
    eye2=dict(iris_mm=11.5, front_mm=11.8, iris_frac=0.405, front_frac=0.414, blend=(28, 62), iris_r=0.00590, cornea_R=0.0078, cornea_lift=0.00012, gaze=(0.0, -0.95, 0.0), kappa=4.0, sclera=(214, 205, 197), lid_dark=0.45, corner_pink=0.16, veins=0.10, wet_r=0.00026, wet_lift=0.00015, cornea_ior=1.376, segs=(64, 48)),
    # brow study 2026-11-14 (flag brows2; not approved): hair strokes on a thin card over the skin. Angles in degrees from level (+ = up), lengths in mm
    brow2=dict(base=0.45, hairs=460, len=(4.0, 7.5, 6.0), angle=((0.0, 78), (0.15, 62), (0.35, 26), (0.62, 14), (1.0, -14)), cross=11, jitter=7, width_mm=0.075, tones=(0.70, 1.0), alpha=(0.85, 1.0), lift=0.0004, tex=(1024, 460), domain=(-0.025, 0.031, 0.002, 0.027)),
    # skin study 2026-11-14 (flag skin2; not approved). Zones: (colour, strength, centre (|x| from eye, z from eye) or None, radius m). Light scatter: Random Walk (Skin), radius per colour, scale in m (Weyrich 2006: about 1.8 / 1.0 / 0.65 mm for red / green / blue)
    skin2=dict(zones=dict(forehead=((236, 210, 182), 0.22, (-0.03, 0.040), 0.030), cheek=((214, 140, 128), 0.20, (0.010, -0.034), 0.022), nose=((212, 132, 122), 0.24, None, 0.012),
                         eyelid=((200, 140, 140), 0.16, (0.0, 0.004), 0.011), undereye=((182, 168, 176), 0.12, (0.0, -0.013), 0.009), mouthring=((206, 186, 172), 0.10, (-0.03, -0.060), 0.016), ear=((208, 128, 116), 0.30, None, 0.0)),
               mottle=(0.014, 0.006), warm=0.10, samples=144, rough=dict(base=0.48, forehead=0.38, nose=0.32, eyelid=0.34, chin=0.42, noise=0.04), sss=1.0, sss_radius=(1.0, 0.56, 0.36), sss_scale=0.0018, sss_aniso=0.8, ior=1.4),
    # teeth study 2026-11-14 (flag teeth2; not approved): the scan-based kit's teeth, gums and tongue. Colours linear 0..1; shade = how much darker the back teeth and the tops under the lip get
    teeth2=dict(enamel=(0.80, 0.76, 0.66), enamel_rough=0.22, enamel_sss=0.25, back_dark=0.75, back_depth=0.020, top_dark=0.35, gum=(0.55, 0.20, 0.21), gum_rough=0.18, tongue=(0.52, 0.20, 0.20), offset=(0.0, 0.0, 0.0), scale=1.25, drop_lower_soft=False),
    teeth3=dict(enamel=(0.82, 0.78, 0.68), warm=(1.0, 0.97, 0.91), warm_from=0.0085, edge=(0.55, 0.57, 0.60), edge_mix=0.45, edge_mm=0.0013, back_depth=0.012, back_dark=0.42, top_from=0.006, top_dark=0.30, rough=0.20, sss=0.3),
    brow_drop=0.0,      # step 2: tried 1.6 mm lower; not needed after the reshape (brow height +8%, inside tolerance) and it made the eye opening measure smaller
    # step 3 (flag step3; sample, not approved 2026-11-14): details matched to the user's neutral reference. Brow: arch height and tail drop in m, thickness factor along the brow, colour. Iris darker; denser upper lash line; upper lip bow.
    step3=dict(brow_arch=0.0010, brow_tail_drop=0.0055, brow_thin=0.50, brow=(66, 52, 42), iris=(92, 110, 108), lash_band=255, lash_root=0.26, cupidsbow=0.35),
    # step 3b (flag shape5, from the same-scale comparison with the reference): thinner, lower, softer brows; eyes opened and iris a little larger; darker lid crease
    step3b=dict(brow_z=0.0135, brow_th=0.0042, brow_hairs=380, brow_len=(3.2, 6.0, 4.8), eye_open=0.0, iris_mm=12.2, crease_dark=0.30, crease_col=(120, 82, 72), crease_w=0.0012,
                chin_up=0.0028, chin_v=(5296, 492), chin_fade=(0.003, 0.011), chin_neck=(0.035, 0.015), chin_back=(0.030, 0.060), chin_smooth=(9, 1.0, 0.018),      # chin touch-up (flag chin2): lower lip to chin was 13% longer than the reference and the chin came to a point with a crease down the middle
                skull_f=0.948, skull_y=(0.020, 0.060), skull_z=(0.030, 0.060), skull_low=(-0.060, -0.100)),      # skull narrowed toward the young-women average breadth (147 mm, was 155): full behind the face and above the brows, none on the face, fading out below the mouth
    cheek_raise=(0.0035, 0.0065, 0.0042), brow_slant=(0.0075, 0.003), chin_crumple=(0.003, 0.006, 0.003), expr_head_pitch={'grin': 6, 'anguish': -6, 'smile_study5p': 10}, ref_image='/home/claude/marla/ref_marla2.jpg', ref_crop=(34, 30, 214, 251),
    key=(48, (0.78, 0.87, 1.0)), rim=(420, (1.0, 0.55, 0.25)), fill=10, world=0.008, samples=48,
    day=dict(key=(46, (1.0, 0.96, 0.90)), rim=(110, (1.0, 0.82, 0.62)), fill=16, world=0.05),   # soft daylight for the game; used with the 'day' argument
)
C = CONFIG
if 'day' in sys.argv: C.update(C['day'])
# ---- other villagers: `python3 -I build.py bram expr day`. A profile only overrides CONFIG values; Marla is the default.
VILL = dict(sculpt=0.7, hair_mid_n=0, hair_front_n=0, hair_fringe_n=0, pink_lock=False, earrings=False, scout_kit=False, silver_trim=False, expr_render=['neutral'], expressions={}, ref_image='',
            hair_clear=0.005, coat_hem=None, collar=None, belt_on=True, hair_rough=0.7)
GREENS = ['#4F6B3A', '#8FA67E', '#2F4A34', '#6E8B3D', '#3F7A5A']; PLAIN = ['#B8862F', '#8A5A6A', '#7A6A4E', '#D9CDB4', '#5E7286', '#A0522D', '#6B4F36', '#C9B38C']
HAIRS = dict(black=((60, 48, 44), (34, 27, 26), (14, 11, 11)), brown=((150, 104, 70), (104, 66, 42), (60, 36, 22)), auburn=((176, 110, 70), (138, 74, 42), (84, 44, 26)),
             blonde=((238, 224, 198), (208, 186, 152), (152, 126, 98)), grey=((236, 236, 232), (200, 200, 198), (150, 150, 150)), white=((250, 250, 248), (228, 228, 226), (186, 186, 186)))
SKINS = dict(light=(229, 199, 184), olive=(204, 170, 134), tan=(196, 150, 118), brown=(160, 112, 84), dark=(122, 82, 60))
def OUTF(jacket, trousers, **k): return dict(dict(jacket=jacket, trousers=trousers, trim='#2F4A34', linen='#D9CDB4', leather='#8A6A47', boots='#4A3829', pewter='#A9B0B3', solar='#5E7286', hat='#D8C078', sleeve='#D9CDB4'), **k)
def HAIR(name): l_, m_, d_ = HAIRS[name]; return dict(hair_light=l_, hair_mid=m_, hair_dark=d_, brow=tuple(int(c_ * 0.8) for c_ in m_))
PROFILES = dict(   # user 2026-11-14: villagers have neutral faces only; every villager wears green; hair, clothing shape, gender, age and features all differ
    bram=dict(VILL, **HAIR('grey'),   # Bram, old gardener: old man, straw hat, moss vest over linen sleeves, khaki trousers
        targets=[('macrodetails/universal-male-old-averagemuscle-averageweight', 0.8), ('macrodetails/universal-male-old-averagemuscle-maxweight', 0.2),
                 ('head/head-age-incr', 0.9), ('head/head-square', 0.5), ('nose/nose-scale-horiz-incr', 0.45), ('nose/nose-scale-vert-incr', 0.3), ('eyes/l-eye-bag-incr', 0.8), ('eyes/r-eye-bag-incr', 0.8),
                 ('chin/chin-width-incr', 0.6), ('chin/chin-bones-incr', 0.6), ('eyes/l-eye-scale-decr', 0.3), ('eyes/r-eye-scale-decr', 0.3), ('mouth/mouth-upperlip-volume-decr', 0.6), ('mouth/mouth-lowerlip-volume-decr', 0.4)],
        skin=SKINS['tan'], lips=(168, 118, 108), iris=(110, 86, 60), lid_shadow=((84, 58, 54), 0.10), wrinkles=0.55, lash_len=0.3,
        hair_style='short', hat=('straw', 'hat'), sleeve_col='sleeve', outfit=OUTF('#4F6B3A', '#7A6A4E')),
    oko=dict(VILL, **HAIR('black'),   # Oko, tinkerer: adult woman, hair in a bun, sleeveless fern top, tool strap, rose trousers
        targets=[('macrodetails/african-female-young', 0.7), ('macrodetails/universal-female-young-averagemuscle-averageweight', 0.6), ('macrodetails/universal-female-young-maxmuscle-averageweight', 0.4),
                 ('head/head-age-incr', 0.25), ('head/head-oval', 0.3), ('chin/chin-width-decr', 0.2)],
        skin=SKINS['dark'], lips=(120, 70, 66), blush=(140, 76, 66), iris=(70, 46, 30), lid_shadow=((50, 32, 28), 0.25), freckle=0.0,
        hair_style='bun', earrings=True, sleeves='none', scout_kit='strap', outfit=OUTF('#2F4A34', '#8A5A6A', leather='#4A3829')),
    ashley=dict(VILL, **HAIR('brown'), targets=[('macrodetails/universal-male-young-averagemuscle-averageweight', 1.0)], skin=(214, 170, 140), lips=(180, 124, 112), iris=(110, 86, 60), outfit=OUTF('#8A8468', '#7A6A4E')),   # Ashley Potts, the player: only his hands are used (`build.py ashley hands`)
    pip=dict(VILL, **HAIR('auburn'),  # Pip, lookout kid: boy, child size, tousled hair, short-sleeved sage shirt, ochre shorts, green neck scarf
        targets=[('macrodetails/universal-male-child-averagemuscle-averageweight', 1.0), ('head/head-round', 0.3), ('cheek/l-cheek-volume-incr', 0.3), ('cheek/r-cheek-volume-incr', 0.3), ('nose/nose-point-up', 0.3)],
        skin=SKINS['light'], lips=(196, 128, 120), iris=(92, 120, 80), lid_shadow=((84, 58, 54), 0.12), lash_len=0.3, body_scale=0.74, head_scale=1.20, boot_top=0.20,
        hair_style='short', sleeves='short', legs='shorts', collar='scarf', belt_on=False, outfit=OUTF('#8FA67E', '#B8862F', trim='#3F7A5A', boots='#6B4F36')),
)
def gen_villager(seed):   # a recruit: gender, age, origin, features, hair and clothing all rolled from the seed; one garment is always green
    r = np.random.default_rng(1000 + seed); ch = lambda L, p=None: L[int(r.choice(len(L), p=p))]
    g = ch(['female', 'male']); age = ch(['child', 'young', 'old'], [0.18, 0.52, 0.30]); eth = ch(['universal', 'african', 'asian'], [0.4, 0.3, 0.3])
    t = [('macrodetails/universal-%s-%s-averagemuscle-averageweight' % (g, age), 0.6), ('macrodetails/universal-%s-%s-averagemuscle-%s' % (g, age, ch(['minweight', 'maxweight', 'averageweight'])), 0.4)]
    if eth != 'universal': t.append(('macrodetails/%s-%s-%s' % (eth, g, age), 0.7))
    t.append(('head/' + ch(['head-oval', 'head-round', 'head-square', 'head-rectangular', 'head-invertedtriangular']), float(r.uniform(0.25, 0.6))))
    for nm in ('nose/nose-scale-horiz', 'nose/nose-scale-vert', 'chin/chin-width', 'chin/chin-height', 'mouth/mouth-scale-horiz', 'forehead/forehead-scale-vert'):
        t.append((nm + ch(['-incr', '-decr']), float(r.uniform(0.15, 0.6))))
    for nm in ('eyes/%s-eye-scale', 'cheek/%s-cheek-bones', 'cheek/%s-cheek-volume'):
        sfx = ch(['-incr', '-decr']); w = float(r.uniform(0.15, 0.5)); t += [((nm % 'l') + sfx, w), ((nm % 'r') + sfx, w)]
    sk = ch({'universal': ['light', 'light', 'olive', 'tan'], 'african': ['brown', 'dark', 'dark'], 'asian': ['light', 'olive', 'tan']}[eth])
    hc = ch(['grey', 'white', 'grey', 'black']) if age == 'old' else ch({'universal': ['brown', 'auburn', 'blonde', 'black'], 'african': ['black'], 'asian': ['black', 'black', 'brown']}[eth])
    hs = ch(['short', 'short', 'bob', 'bun', 'long'] if g == 'female' else ['short', 'short', 'short', 'bob'])
    green = ch(['jacket', 'trousers', 'scarf', 'hat']); jk = ch(GREENS if green == 'jacket' else PLAIN); tr = ch(GREENS if green == 'trousers' else [p_ for p_ in PLAIN if p_ != jk])
    p = dict(VILL, **HAIR(hc), targets=t, skin=SKINS[sk], lips=tuple(int(c_ * 0.86) for c_ in SKINS[sk][:1]) + (int(SKINS[sk][1] * 0.66), int(SKINS[sk][2] * 0.66)), iris=ch([(110, 86, 60), (70, 46, 30), (92, 120, 80), (96, 120, 140)] if eth == 'universal' else [(70, 46, 30), (50, 34, 24)]),
             lid_shadow=((60, 40, 36), 0.12), freckle=0.0 if sk in ('brown', 'dark') else float(r.uniform(0, 0.5)), lash_len=1.0 if g == 'female' else 0.3, hair_style=hs,
             hair_fringe_n=int(ch([0, 6, 8])) if hs in ('bob', 'long') else 0, earrings=bool(g == 'female' and r.random() < 0.4),
             sleeves=ch(['long', 'long', 'short', 'none']), legs='shorts' if age == 'child' and r.random() < 0.6 else 'long', collar=('scarf' if green == 'scarf' else ch([None, None, 'linen', 'scarf'])),
             hat=((ch(['straw', 'cap']), 'trim') if green == 'hat' else (ch([None, None, None, ('straw', 'hat'), ('cap', 'sleeve')]))), sleeve_col=ch([None, None, 'sleeve']),
             coat_hem=ch([None, (0.06, -0.06, 0.012, 0.016), (0.06, -0.20, 0.014, 0.030)]) if g == 'male' else ch([None, (0.06, -0.075, 0.024, 0.040), (0.06, -0.34, 0.020, 0.060)]),
             belt_on=bool(r.random() < 0.6), scout_kit=ch([False, False, 'strap']), outfit=OUTF(jk, tr, trim=ch(GREENS), boots=ch(['#4A3829', '#6B4F36', '#3A3A3A'])))
    if age == 'old': p.update(wrinkles=float(r.uniform(0.4, 0.65)), body_scale=0.97)
    if age == 'child': p.update(body_scale=float(r.uniform(0.68, 0.80)), head_scale=1.20, boot_top=0.20, scout_kit=False)
    if age == 'young': p.update(body_scale=float(r.uniform(0.95, 1.03)) * (0.97 if g == 'female' else 1.0))
    print('VILLAGER', seed, g, age, eth, sk, hc, hs, 'green:', green); return p
ROLL = next((a_ for a_ in sys.argv if a_.startswith('roll:')), None)
if ROLL:   # supply check: roll N recruits without building; every one must have valid face data and wear green
    import collections, io, contextlib; cnt = collections.Counter(); bad = []; looks = set()
    for sd in range(int(ROLL[5:])):
        with contextlib.redirect_stdout(io.StringIO()) as buf: p = gen_villager(sd)
        w = buf.getvalue().split(); cnt[w[2]] += 1; cnt[w[3]] += 1; cnt['origin ' + w[4]] += 1; cnt['hair ' + p['hair_style']] += 1
        miss = [n for n, _ in p['targets'] if not os.path.exists(D + 'targets/' + n + '.target.gz')]
        o = p['outfit']; green = o['jacket'] in GREENS or o['trousers'] in GREENS or p.get('collar') == 'scarf' or (p.get('hat') and p['hat'][1] == 'trim')
        if miss or not green: bad.append((sd, miss, green))
        looks.add((w[2], w[3], w[4], w[5], w[6], p['hair_style'], o['jacket'], o['trousers'], p['sleeves'], p['legs'], str(p.get('collar')), str(p.get('hat')), str(p['coat_hem'])))
    print('ROLLED', ROLL[5:], '| distinct looks', len(looks), '|', dict(cnt)); print('PASS' if not bad else 'FAIL %s' % bad[:5]); sys.exit(0)
if 'step3' in sys.argv: C.update(brow=C['step3']['brow'], iris=C['step3']['iris']); C['targets'] = C['targets'] + [('mouth/mouth-cupidsbow-incr', C['step3']['cupidsbow'])]
if 'shape4' in sys.argv:      # step 2, second method: base-model shape sliders solved against the user's reference (shape_solve.py); sample, not approved
    C['targets'] = C['targets'] + [tuple(t_) for t_ in json.load(open('/home/claude/marla/target/shape4_weights.json'))['targets']]; OUT = '/home/claude/marla/out_shape4/'; os.makedirs(OUT + 'tex', exist_ok=True)
FACEB = 'faceB' in sys.argv      # route 2 sample: face moved toward the user's grin reference (shorter nose, lower brows, slightly shorter chin); not approved
if FACEB: C['targets'] = C['targets'] + [('nose/nose-scale-vert-decr', 0.40), ('eyebrows/eyebrows-trans-down', 0.60), ('chin/chin-height-decr', 0.15)]; OUT = '/home/claude/marla/out_faceB/'; os.makedirs(OUT + 'tex', exist_ok=True)
if 'eyes2' in sys.argv and 'faceB' not in sys.argv: OUT = '/home/claude/marla/out_eyes2/' if 'brows2' not in sys.argv else ('/home/claude/marla/out_teeth2/' if 'teeth2' in sys.argv else ('/home/claude/marla/out_skin2/' if 'skin2' in sys.argv else '/home/claude/marla/out_eyes3/')); os.makedirs(OUT + 'tex', exist_ok=True)
if 'profile2' in sys.argv: OUT = '/home/claude/marla/out_profile2/'; os.makedirs(OUT + 'tex', exist_ok=True)
if 'shape3' in sys.argv: OUT = '/home/claude/marla/out_shape3/'; os.makedirs(OUT + 'tex', exist_ok=True)
if 'shape4' in sys.argv: OUT = '/home/claude/marla/out_step3/' if 'step3' in sys.argv else '/home/claude/marla/out_shape4/'; os.makedirs(OUT + 'tex', exist_ok=True)
if 'shape5' in sys.argv: OUT = '/home/claude/marla/out_shape5/'; os.makedirs(OUT + 'tex', exist_ok=True)
if 'shape5' in sys.argv:
    S3B_ = C['step3b']; C['targets'] = C['targets'] + [('eyes/l-eye-height2-incr', S3B_['eye_open']), ('eyes/r-eye-height2-incr', S3B_['eye_open'])]
    C['eye2'] = dict(C['eye2'], iris_mm=S3B_['iris_mm']); C['brow2'] = dict(C['brow2'], hairs=S3B_['brow_hairs'], len=S3B_['brow_len'])
GAME = 'game' in sys.argv      # light export for the game: small textures, colour maps only, three expressions, no normals
if GAME: C.update(tex=512, expressions={k_: C['expressions'][k_] for k_ in ('smile', 'grin', 'puzzled')}); OUT = '/home/claude/marla/out_game/'; os.makedirs(OUT + 'tex', exist_ok=True)
WHO = next((k_ for k_ in PROFILES if k_ in sys.argv), None)
GEN = next((a_ for a_ in sys.argv if a_.startswith('gen:')), None)
if GEN: WHO = 'gen' + GEN[4:]; PROFILES[WHO] = gen_villager(int(GEN[4:]))
if WHO:
    C.update(PROFILES[WHO]); OUT = '/home/claude/marla/out_%s/' % WHO; os.makedirs(OUT + 'tex', exist_ok=True)
    if GAME: C['expressions'] = {}; OUT = '/home/claude/marla/out_game_%s/' % WHO; os.makedirs(OUT + 'tex', exist_ok=True)
    ST = dict(short=dict(shell_end=('chin', 0.115), shell_lift=0.004, tufts=30), bun=dict(shell_end=('chin', 0.05), shell_lift=0.006, tufts=8, bun=True),
              bob=dict(shell_end=('chin', 0.0), lock_end=0.0, hair_mid_n=12, hair_front_n=6), long=dict(hair_mid_n=10, hair_front_n=7))[C.get('hair_style', 'long')]
    C.update(ST)
rng = np.random.default_rng(C['seed'])

# ----------------------------------------------------------------- load data
V = []; VT = []; G = {}; g = None
for l in open(D + '3dobjs/base.obj'):
    if l.startswith('v '): V.append([float(t) for t in l.split()[1:4]])
    elif l.startswith('vt '): VT.append([float(t) for t in l.split()[1:3]])
    elif l.startswith('g '): g = l.split()[1]
    elif l.startswith('f '):
        G.setdefault(g, []).append([(int(t.split('/')[0]) - 1, int(t.split('/')[1]) - 1) for t in l.split()[1:]])
V = np.array(V); VT = np.array(VT)
for name, w in C['targets']:
    p = D + 'targets/' + name + '.target.gz'
    if not os.path.exists(p): print('MISSING target', name); continue
    for l in gzip.open(p, 'rt'):
        t = l.split()
        if len(t) == 4 and not l.startswith('#'):
            V[int(t[0])] += w * np.array([float(t[1]), float(t[2]), float(t[3])])
B = np.c_[V[:, 0], -V[:, 2], V[:, 1]] * 0.1
body_idx = np.unique([v for f in G['body'] for v, _ in f])
SHIFT = -B[body_idx, 2].min()
B[:, 2] += SHIFT
if C.get('body_scale', 1.0) != 1.0 or C.get('head_scale', 1.0) != 1.0:      # children: smaller body, relatively bigger head
    B *= C.get('body_scale', 1.0); Hh_ = B[body_idx, 2].max(); nb_ = B[body_idx][np.abs(B[body_idx, 2] - 0.845 * Hh_) < 0.01 * Hh_]; pv_ = np.array([0.0, nb_[:, 1].mean(), 0.845 * Hh_])
    f_ = np.clip((B[:, 2] - 0.835 * Hh_) / (0.03 * Hh_), 0, 1); f_ = f_ * f_ * (3 - 2 * f_)
    B[:] = pv_ + (B - pv_) * (1 + (C.get('head_scale', 1.0) - 1) * f_)[:, None]
GI = {k: np.unique([v for f in fs for v, _ in f]) for k, fs in G.items()}
rig = json.load(open(D + 'rigs/standard/rig.game_engine.json'))
wts = json.load(open(D + 'rigs/standard/weights.game_engine.json'))['weights']
VW = {}
for bn, lst in wts.items():
    for i, w in lst:
        VW.setdefault(i, []).append((bn, w))
for i in VW:
    l = sorted(VW[i], key=lambda t: -t[1])[:4]; s = sum(w for _, w in l)
    VW[i] = [(b, w / s) for b, w in l]
def wsum(i, pred): return sum(w for b, w in VW.get(i, []) if pred(b))
def dom(i): return VW[i][0][0] if i in VW else ''
HANDB = lambda b: b.startswith(('hand_', 'thumb', 'index', 'middle', 'ring', 'pinky'))
HEADB = lambda b: b in ('head', 'neck_01')

def jp(d):
    if d.get('cube_name') in GI: return Vector(B[GI[d['cube_name']]].mean(0))
    if d.get('vertex_indices'): return Vector(B[d['vertex_indices']].mean(0))
    p = Vector(d['default_position']); p.z += SHIFT; return p

if 'hands' in sys.argv:   # first-person hands for the game: posed hand + forearm meshes, written as plain numbers (no textures, no loader needed)
    def J(b, e='head'): return np.array(jp(rig[b][e]))
    def rot(ax, ang):
        ax = ax / np.linalg.norm(ax); K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]]); return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
    def about(R, c): M = np.eye(4); M[:3, :3] = R; M[:3, 3] = c - R @ c; return M
    out = {}
    for sd in ('l', 'r'):
        wrist = J('hand_' + sd); f = wrist - J('lowerarm_' + sd); f /= np.linalg.norm(f)
        n = np.cross(J('index_01_' + sd) - J('pinky_01_' + sd), J('middle_01_' + sd) - wrist); n /= np.linalg.norm(n)
        if (J('thumb_03_' + sd, 'tail') - wrist) @ n < 0: n = -n                       # palm side
        side = J('index_01_' + sd) - J('pinky_01_' + sd); side /= np.linalg.norm(side)  # towards the thumb side
        pose = C['hand_pose'][sd]; M = {}
        for fg in ('thumb', 'index', 'middle', 'ring', 'pinky'):
            T = np.eye(4); curl, spread = pose[fg]
            for k in (1, 2, 3):
                bn = '%s_0%d_%s' % (fg, k, sd); h = J(bn); d = J(bn, 'tail') - h; d /= np.linalg.norm(d)
                ax = np.cross(d, n if fg != 'thumb' else side); R = rot(ax, curl[k - 1])
                if (R @ d - d) @ (n if fg != 'thumb' else side) < 0: R = rot(ax, -curl[k - 1])     # curl goes toward the palm (thumb: across the palm)
                if k == 1 and spread:
                    Rs = rot(n, spread)
                    if (Rs @ d - d) @ side < 0: Rs = rot(n, -spread)                               # positive spread = toward the thumb side
                    R = Rs @ R
                T = T @ about(R, h); M[bn] = T
        HB = lambda b: b.endswith('_' + sd) and HANDB(b); LB = lambda b: b == 'lowerarm_' + sd
        faces = [[v for v, _ in fc] for fc in G['body'] if np.mean([wsum(v, HB) for v, _ in fc]) >= 0.5]
        faces += [[v for v, _ in fc] for fc in G['helper-tights'] if np.mean([wsum(v, lambda b: LB(b) or HB(b)) for v, _ in fc]) >= 0.5]
        used = sorted(set(v for fc in faces for v in fc)); remap = {v: k for k, v in enumerate(used)}
        yb = -n; zf = -f; yb = yb - (yb @ zf) * zf; yb /= np.linalg.norm(yb); xb = np.cross(yb, zf); P = []
        for v in used:
            p4 = np.append(B[v], 1.0); q = np.zeros(4); wt = 0
            for b, w in VW.get(v, []): q += w * ((M[b] @ p4) if b in M else p4); wt += w
            q = (q / wt)[:3] if wt else B[v]; lp = q - wrist; P += [round(float(lp @ xb), 4), round(float(lp @ yb), 4), round(float(lp @ zf), 4)]
        I = []
        for fc in faces:
            for k in range(1, len(fc) - 1): I += [remap[fc[0]], remap[fc[k]], remap[fc[k + 1]]]
        gp = (J('index_01_' + sd) + J('pinky_01_' + sd)) / 2 + n * 0.030 + f * 0.012 - wrist
        out[sd] = dict(p=P, i=I, t=1 if side @ xb > 0 else -1, g=[round(float(gp @ xb), 4), round(float(gp @ yb), 4), round(float(gp @ zf), 4)]); print('HAND', sd, len(used), 'verts', len(I) // 3, 'tris')
    open('/home/claude/solard-g/src/handsdata.js', 'w').write('// generated by marla/scripts/build.py ashley hands: Ashley\'s posed hand + forearm meshes (metres, wrist at the origin, fingers along -z, back of the hand +y)\nexport const HANDS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    sys.exit(0)


if 'facecount' in sys.argv:
    HEADB_ = lambda b: b in ('head', 'neck_01') or b.startswith(('jaw', 'eye', 'tongue', 'special', 'oris', 'levator', 'orbicularis', 'temporalis', 'risorius'))
    hf_ = [f for f in G['body'] if np.mean([wsum(v, lambda b: b == 'head') for v, _ in f]) >= 0.5]
    ft_ = [f for f in hf_ if np.mean([B[v][1] for v, _ in f]) < np.mean([B[v][1] for f2 in hf_ for v, _ in f2])]
    tri = lambda L: sum(len(f) - 2 for f in L)
    print('FACECOUNT head tris', tri(hf_), 'front half (face) tris', tri(ft_), 'whole body tris', tri(G['body'])); sys.exit(0)
# ----------------------------------------------------------------- profile fix (flag profile2; sample, not approved 2026-11-14)
# Lower face (nose, lips, chin) moved in depth and height to the scan average's, fitted on the upper face (profile_targets.py); widths, eyes, brows and forehead stay Marla's.
SHAPE = 'shape5' if 'shape5' in sys.argv else ('shape3' if 'shape3' in sys.argv else ('profile2' if 'profile2' in sys.argv else None))      # shape3: step 2 reshape to the user's front reference and young-women profile norms (shape_targets.py)
if SHAPE:
    from scipy.interpolate import RBFInterpolator
    PT = np.load('/home/claude/marla/%s.npz' % {'shape3': 'shape_targets', 'shape5': 'shape5_targets'}.get(SHAPE, 'profile_targets')); el_ = B[GI['joint-l-eye']].mean(0); hv_ = np.array(sorted(set(v_ for f_ in G['body'] for v_, _ in f_)))
    Hh_ = B[hv_]; back_ = Hh_[Hh_[:, 1] > el_[1] + 0.05][::40]; neck_ = Hh_[(Hh_[:, 2] < PT['src'][:, 2].min() - 0.045) & (Hh_[:, 2] > PT['src'][:, 2].min() - 0.12)][::40]; side_ = Hh_[(np.abs(Hh_[:, 0]) > (0.062 if SHAPE == 'profile2' else 0.076)) & (Hh_[:, 2] > el_[2] - (0.03 if SHAPE == 'shape5' else 0.08)) & (Hh_[:, 2] < el_[2] + 0.06)][::40]
    ctr_ = np.vstack([PT['src'], PT['anchors'], back_, neck_, side_]); val_ = np.vstack([PT['dst'] - PT['src'], np.zeros((len(ctr_) - len(PT['src']), 3))])
    fld_ = RBFInterpolator(ctr_, val_, kernel='thin_plate_spline', smoothing=1e-6)
    reg_ = np.where((B[:, 2] > PT['src'][:, 2].min() - 0.06) & (B[:, 2] < el_[2] + 0.08) & (B[:, 1] < el_[1] + 0.06))[0]
    dP_ = fld_(B[reg_]); fade_ = np.clip(1 - (B[reg_, 1] - (el_[1] + 0.03)) / 0.03, 0, 1) * np.clip((B[reg_, 2] - (PT['src'][:, 2].min() - 0.06)) / 0.02, 0, 1)
    B0p_ = B.copy(); B[reg_] += dP_ * fade_[:, None]
    for hk_, lid_ in (('helper-upper-teeth', 62), ('helper-lower-teeth', 66), ('helper-tongue', 66)):      # teeth and tongue move as one piece with the inner lip in front of them (point by point they lagged the lips and showed at rest)
        if hk_ not in G: continue
        hv2_ = np.array(sorted(set(v_ for f_ in G[hk_] for v_, _ in f_))); k_ = list(PT['ids']).index(lid_); B[hv2_] = B0p_[hv2_] + (PT['dst'][k_] - PT['src'][k_]); print(SHAPE.upper() + ' %s moved %s mm' % (hk_, np.round(1000 * (PT['dst'][k_] - PT['src'][k_]), 1)))
    print(SHAPE.upper() + ' moved %d points, largest %.1f mm, at the lips %.1f mm' % (len(reg_), 1000 * np.linalg.norm(dP_ * fade_[:, None], axis=1).max(), 1000 * np.linalg.norm(PT['dst'][12] - PT['src'][12])))
if 'shape5' in sys.argv:      # skull sides only: x scaled toward the middle line behind the face and above the brows; face, eyes and brows stay
    S3B_ = C['step3b']; el_ = B[GI['joint-l-eye']].mean(0); ss_ = lambda u: np.clip(u, 0, 1) ** 2 * (3 - 2 * np.clip(u, 0, 1))
    wy_ = ss_((B[:, 1] - (el_[1] + S3B_['skull_y'][0])) / (S3B_['skull_y'][1] - S3B_['skull_y'][0])); wz_ = ss_((B[:, 2] - (el_[2] + S3B_['skull_z'][0])) / (S3B_['skull_z'][1] - S3B_['skull_z'][0]))
    wl_ = ss_((B[:, 2] - (el_[2] + S3B_['skull_low'][1])) / (S3B_['skull_low'][0] - S3B_['skull_low'][1])); w_ = np.maximum(wy_, wz_) * wl_
    bw0_ = np.ptp(B[np.abs(B[:, 2] - el_[2] - 0.03) < 0.003][:, 0]); B[:, 0] *= 1 - (1 - S3B_['skull_f']) * w_
    print('SKULL width 30 mm above the eyes %.0f -> %.0f mm, %d points moved' % (1000 * bw0_, 1000 * np.ptp(B[np.abs(B[:, 2] - el_[2] - 0.03) < 0.003][:, 0]), int((w_ > 0.01).sum())))
if 'chin2' in sys.argv:      # chin up as one piece below the lower lip (lips stay), fading out into the neck and toward the ears; then the chin front is smoothed side to side to round off the middle crease
    S3B_ = C['step3b']; el_ = B[GI['joint-l-eye']].mean(0); ss_ = lambda u: np.clip(u, 0, 1) ** 2 * (3 - 2 * np.clip(u, 0, 1)); v8_, v57_ = S3B_['chin_v']; z8_, z57_ = B[v8_, 2], B[v57_, 2]
    keep_ = np.zeros(len(B), bool)
    for hk_ in ('helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue'):
        if hk_ in G: keep_[[v_ for f_ in G[hk_] for v_, _ in f_]] = True
    w_ = ss_((z57_ - S3B_['chin_fade'][0] - B[:, 2]) / (S3B_['chin_fade'][1] - S3B_['chin_fade'][0])) * ss_((B[:, 2] - (z8_ - S3B_['chin_neck'][0])) / (S3B_['chin_neck'][0] - S3B_['chin_neck'][1])) * ss_(((el_[1] + S3B_['chin_back'][1]) - B[:, 1]) / (S3B_['chin_back'][1] - S3B_['chin_back'][0])) * ~keep_
    B[:, 2] += S3B_['chin_up'] * w_
    it_, a_, hw_ = S3B_['chin_smooth']; yf_ = B[v8_, 1]; z8_, z57_ = B[v8_, 2], B[v57_, 2]
    sel_ = np.where((np.abs(B[:, 0]) < hw_) & (B[:, 2] > z8_ - 0.002) & (B[:, 2] < z57_ - 0.005) & (B[:, 1] < yf_ + 0.008) & ~keep_)[0]
    y0_ = B[sel_, 1].copy(); Pc_ = B[sel_].copy(); mid_ = np.abs(Pc_[:, 0]) < 0.001      # middle-line points only: each set onto the smooth curve through its row's points 2 to 9 mm either side (it stood about 0.7 mm proud: the crease)
    for k_ in np.where(mid_)[0]:
        row_ = (np.abs(Pc_[:, 2] - Pc_[k_, 2]) < 0.0012) & (np.abs(Pc_[:, 0]) > 0.002) & (np.abs(Pc_[:, 0]) < it_ * 0.001) & (np.abs(Pc_[:, 1] - Pc_[k_, 1]) < 0.005)
        dzl_ = z57_ - Pc_[k_, 2]
        if len(set(np.round(1000 * np.abs(Pc_[row_, 0])).astype(int))) < 2 or not (0.007 < dzl_ < 0.017): continue      # needs two distances from the middle; only the chin's front face (the turn under the chin and the lip fold are not a crease)
        cf_ = np.polyfit(Pc_[row_, 0] ** 2, Pc_[row_, 1], 1); B[sel_[k_], 1] = y0_[k_] + a_ * float(np.clip(cf_[1] - y0_[k_], 0, 0.001))      # only ever back, at most 1 mm
        if 'chindebug' in sys.argv: print('CHINDBG z %.1f below lip, mid y %.2f, fit %.2f, n %d, row x %s' % (1000 * (z57_ - Pc_[k_, 2]), 1000 * (y0_[k_] - yf_), 1000 * (cf_[1] - yf_), row_.sum(), np.round(1000 * Pc_[row_, 0]).astype(int).tolist()))
    print('CHIN2 up %.1f mm on %d points; chin front smoothed on %d points, depth change largest %.2f mm, middle line %+.2f mm (+ = back)' % (1000 * S3B_['chin_up'], int((w_ > 0.01).sum()), len(sel_), 1000 * np.abs(B[sel_, 1] - y0_).max(), 1000 * np.mean((B[sel_, 1] - y0_)[np.abs(B[sel_, 0]) < 0.001])))
# ----------------------------------------------------------------- landmarks
EL = B[GI['joint-l-eye']].mean(0); ER = B[GI['joint-r-eye']].mean(0)
ex = abs(EL[0]); ez = EL[2]; ey = EL[1]
head_v = np.array([i for i in body_idx if dom(i) == 'head'])
HP = B[head_v]
ztop = HP[:, 2].max()
mid = HP[np.abs(HP[:, 0]) < 0.004]
front = mid[(mid[:, 2] < ez) & (mid[:, 2] > ez - 0.07)]
nose = front[front[:, 1].argmin()]
chin_c = mid[(mid[:, 1] < nose[1] + 0.035)]
zchin = chin_c[:, 2].min()
H = B[body_idx, 2].max()
earx = np.abs(HP[:, 0]).max()
print('LAND height %.3f head %.3f ratio %.2f eye %s nose %s chin %.3f earx %.3f' % (H, ztop - zchin, H / (ztop - zchin), np.round(EL, 3), np.round(nose, 3), zchin, earx))

# ----------------------------------------------------------------- scene helpers
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
OBJS = []
def mk(name, faces, offset=0.0, weights=True):
    idx = sorted(set(v for f in faces for v, _ in f)); rm = {v: k for k, v in enumerate(idx)}
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(B[i]) for i in idx], [], [[rm[v] for v, _ in f] for f in faces]); me.update()
    uv = me.uv_layers.new(name='uv')
    flat = [c for f in faces for _, t in f for c in VT[t]]
    uv.data.foreach_set('uv', flat)
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    if offset:
        for v in me.vertices: v.co = v.co + v.normal * offset
    if weights:
        grp = {}
        for k, i in enumerate(idx):
            for b, w in VW.get(i, [('head', 1.0)]):
                grp.setdefault(b, []).append((k, w))
        for b, lst in grp.items():
            vg = ob.vertex_groups.new(name=b)
            for k, w in lst: vg.add([k], w, 'REPLACE')
    OBJS.append(ob)
    return ob, idx
def mk_raw(name, verts, faces, uvs=None, bone='head'):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    uv = me.uv_layers.new(name='uv')
    if uvs is None: uvs = [(math.atan2(q[1], q[0]) * 0.15 / 1.2, q[2] / 1.2) for q in verts]   # parts built without UVs (belt, straps) get them from their place round the body, so the cloth texture shows
    uv.data.foreach_set('uv', [c for f in faces for k in f for c in uvs[k]])
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    vg = ob.vertex_groups.new(name=bone); vg.add(list(range(len(verts))), 1.0, 'REPLACE')
    OBJS.append(ob); return ob
def img(path, noncolor=False):
    im = bpy.data.images.load(path)
    if noncolor: im.colorspace_settings.name = 'Non-Color'
    return im
def mat(name, color=(1, 1, 1), rough=0.5, metal=0.0, base=None, orm=None, nrm=None, nstr=1.0, alpha_clip=False, coat=0.0, scale=None, spec=None, cloth=None):
    # cloth: a klad-painted fabric (weave, twill, hide) multiplied with `color`, so one pale texture is dyed per garment
    if GAME: orm = None; nrm = None
    if cloth and C.get('cloth_tex', True): base = '/home/claude/marla/out/tex/cloth_%s%s' % (cloth, '_s.jpg' if GAME else '.png'); scale = scale or C.get('cloth_scale', {}).get(cloth, 5)
    else: cloth = None
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if coat: bs.inputs['Coat Weight'].default_value = coat; bs.inputs['Coat Roughness'].default_value = 0.03
    mp = None
    if spec is not None: bs.inputs['Specular IOR Level'].default_value = spec
    if scale:
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (scale, scale, 1); nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    def tex(path, nc):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img(path, nc)
        if mp: nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
        return t
    if base:
        t = tex(base, False)
        if cloth:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
            nt.links.new(t.outputs['Color'], mx.inputs['A']); mx.inputs['B'].default_value = (*color, 1); nt.links.new(mx.outputs['Result'], bs.inputs['Base Color'])
        else: nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
        if alpha_clip:
            r = nt.nodes.new('ShaderNodeMath'); r.operation = 'ROUND'
            nt.links.new(t.outputs['Alpha'], r.inputs[0]); nt.links.new(r.outputs[0], bs.inputs['Alpha'])
    if orm:
        t = tex(orm, True); s = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(t.outputs['Color'], s.inputs['Color'])
        nt.links.new(s.outputs['Green'], bs.inputs['Roughness']); nt.links.new(s.outputs['Blue'], bs.inputs['Metallic'])
    if nrm:
        t = tex(nrm, True); n = nt.nodes.new('ShaderNodeNormalMap'); n.inputs['Strength'].default_value = nstr
        nt.links.new(t.outputs['Color'], n.inputs['Color']); nt.links.new(n.outputs['Normal'], bs.inputs['Normal'])
    return m

# ----------------------------------------------------------------- skin: keep head, neck, hands
keepf = [f for f in G['body'] if any(wsum(v, HEADB) > 0.05 or wsum(v, HANDB) > 0.05 for v, _ in f)]
N = C['tex']
def raster(faces):
    pos = np.zeros((N, N, 3), np.float32); msk = np.zeros((N, N), bool)
    for f in faces:
        for a, b, c in ((0, 1, 2), (0, 2, 3)):
            P = [B[f[k][0]] for k in (a, b, c)]
            U = [(VT[f[k][1]][0] * N, (1 - VT[f[k][1]][1]) * N) for k in (a, b, c)]
            (x0, y0), (x1, y1), (x2, y2) = U
            den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(den) < 1e-9: continue
            mnx = max(int(min(x0, x1, x2)) - 1, 0); mxx = min(int(max(x0, x1, x2)) + 1, N - 1)
            mny = max(int(min(y0, y1, y2)) - 1, 0); mxy = min(int(max(y0, y1, y2)) + 1, N - 1)
            if mxx < mnx or mxy < mny: continue
            X, Y = np.meshgrid(np.arange(mnx, mxx + 1) + .5, np.arange(mny, mxy + 1) + .5)
            wa = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / den
            wb = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / den
            wc = 1 - wa - wb; e = -0.03
            ins = (wa >= e) & (wb >= e) & (wc >= e)
            Q = wa[..., None] * P[0] + wb[..., None] * P[1] + wc[..., None] * P[2]
            pos[mny:mxy + 1, mnx:mxx + 1][ins] = Q[ins]; msk[mny:mxy + 1, mnx:mxx + 1][ins] = True
    return pos, msk
pos, msk = raster(keepf)
X, Y, Z = pos[..., 0], pos[..., 1], pos[..., 2]
def ld(n): return np.asarray(Image.open(D + 'textures/' + n).convert('L').resize((N, N)), np.float32) / 255
lipm = ld('mpfb_lips.jpg'); lidm = ld('mpfb_eyelids.jpg')
def gauss(d2, r): return np.exp(-d2 / (2 * r * r))
def blur(a, k):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(k))
    return np.asarray(im, np.float32) / 255
frontm = (Y < ey + 0.05) & msk & (Z > zchin - 0.01)
ax = np.abs(X)
# ----------------------------------------------------------------- sculpt pass (user 2026-11-14: "do sculpting for her")
# Soft brushes push and pull the face surface by fractions of a millimetre to give it modelled forms; fine detail goes into the normal map further down.
lsel_ = (lipm > 0.5) & msk & frontm; mzS = float(Z[lsel_].mean()); mwS = float(ax[lsel_].max()); ltS = float(Z[lsel_].max()); lbS = float(Z[lsel_].min())
fv_ = np.array([i for i in head_v if B[i][1] < ey + 0.05]); nt_ = fv_[np.abs(B[fv_, 0]) < 0.006]; znS = float(B[nt_[np.argmin(B[nt_, 1])], 2])
SCULPT_F = {}                                                  # per-brush displacement fields at 1 mm (the editor shows them as sliders)
if C.get('sculpt', 0):
    Pq = B[fv_].copy(); cqS = np.array([0.0, ey + 0.065, ez - 0.01]); nq = Pq - cqS; nq /= np.linalg.norm(nq, axis=1, keepdims=True); aq = np.abs(Pq[:, 0])
    def fld(x, z, r, mm, rz=None, signed=False):                    # one brush stamp at (|x|, z): + pushes the surface out, - presses it in (signed: one side only)
        g_ = np.exp(-(((Pq[:, 0] if signed else aq) - x) ** 2 / (2 * r * r) + (Pq[:, 2] - z) ** 2 / (2 * (rz or r) ** 2))); return nq * (g_ * mm * 0.001)[:, None]
    def line(x0, z0, x1, z1, r, n_=6): return [(x0 + (x1 - x0) * k_ / (n_ - 1), z0 + (z1 - z0) * k_ / (n_ - 1), r, 2 / n_, None) for k_ in range(n_)]
    pz_ = (znS - 0.011 + ltS) / 2
    BRUSH = dict(   # name -> stamps (x, z, radius, relative strength, vertical radius)
        cheekbone=[(ex + 0.020, ez - 0.027, 0.014, 1, None)], apple=[(ex + 0.004, znS - 0.006, 0.013, 1, None)], cheek_hollow=[(ex + 0.016, mzS + 0.004, 0.014, 1, None)],
        nasolabial=line(0.017, znS - 0.004, 0.027, mzS + 0.004, 0.0045), philtrum=[(0.0, pz_, 0.0032, 1, 0.006), (0.0055, pz_, 0.0022, -0.5, 0.006)],
        lip_tubercle=[(0.0, ltS - 0.002, 0.005, 1, None)], lower_lip=[(0.009, (mzS + lbS) / 2 - 0.001, 0.007, 1, None)], mouth_corner=[(mwS + 0.002, mzS, 0.005, 1, None)],
        under_lip=[(0.0, lbS - 0.006, 0.008, 1, 0.004)], chin_ball=[(0.0, zchin + 0.017, 0.011, 1, None)], brow_bone=[(ex + 0.002, ez + 0.019, 0.013, 1, 0.005)],
        tear_trough=[(ex - 0.011, ez - 0.013, 0.006, 1, None)], temple=[(ex + 0.034, ez + 0.022, 0.014, 1, None)], nose_bridge_side=[(0.010, ez - 0.012, 0.006, 1, 0.012)],
        nose_tip=[(0.0, znS, 0.005, 1, None)], alar_crease=[(0.0155, znS - 0.002, 0.0038, 1, None)], nasion=[(0.0, ez + 0.003, 0.006, 1, None)], jaw_line=[(ex + 0.030, mzS - 0.012, 0.012, 1, 0.006)])
    dS = np.zeros_like(Pq)
    for nm_, st_ in BRUSH.items():
        SCULPT_F[nm_] = sum(fld(x_, z_, r_, m_, rz_) for x_, z_, r_, m_, rz_ in st_)
        if 'units' not in sys.argv: dS += SCULPT_F[nm_] * C['sculpt_brushes'].get(nm_, 0) * C['sculpt']      # in the editor build these stay sliders
    for x_, z_, r_, mm_, sym_ in C.get('sculpt_stamps', []): dS += fld(abs(x_) if sym_ else x_, z_, r_, mm_, None, not sym_)      # the user's own stamps from the editor
    B[fv_] += dS; print('SCULPT verts', len(fv_), 'max move mm', round(float(np.linalg.norm(dS, axis=1).max() * 1000), 2))
col = np.zeros((N, N, 3), np.float32) + np.array(C['skin'], np.float32)
lowf = blur(rng.random((N, N)), 40); lowf = (lowf - lowf.mean()) / (lowf.std() + 1e-6)
col *= (1 + 0.012 * lowf)[..., None]
def tint(m, c):
    global col
    col = col * (1 - m[..., None]) + np.array(c, np.float32) * m[..., None]
cheek = gauss((ax - (ex + 0.014)) ** 2 + (Z - (ez - 0.038)) ** 2, 0.02) * frontm
SKIN2 = 'skin2' in sys.argv
if not SKIN2: tint(C['blush_cheek'] * cheek, C['blush'])
nz = gauss((X - nose[0]) ** 2 + (Y - nose[1]) ** 2 + (Z - nose[2]) ** 2, 0.011) * msk
if not SKIN2: tint(C['blush_nose'] * nz, C['blush'])
eyer = gauss((ax - ex) ** 2 + (Z - (ez - 0.004)) ** 2, 0.016) * frontm
if not SKIN2: tint(np.clip(C['blush_eye'] * eyer, 0, 0.6), (196, 140, 134))
tint(C['lid_shadow'][1] * blur(lidm, 3) * msk, C['lid_shadow'][0])
ear = np.clip((ax - 0.9 * earx) / (0.1 * earx), 0, 1) * msk * (Z > zchin)
if not SKIN2: tint(0.3 * ear, C['blush'])
if SKIN2:      # broad colour zones of real skin instead of blush discs: warm-yellow forehead, red cheeks, nose and ears, pink-red lids, cool under the eyes and round the mouth; soft mottling at two sizes
    S2 = C['skin2']; ZN = S2['zones']
    def zone_(c_, r_): return gauss((ax - (ex + c_[0])) ** 2 + (Z - (ez + c_[1])) ** 2, r_) * frontm
    tint(ZN['forehead'][1] * gauss(X ** 2 + (Z - (ez + ZN['forehead'][2][1])) ** 2, ZN['forehead'][3]) * frontm, ZN['forehead'][0])
    tint(ZN['cheek'][1] * zone_(ZN['cheek'][2], ZN['cheek'][3]), ZN['cheek'][0])
    tint(ZN['nose'][1] * nz, ZN['nose'][0])
    tint(ZN['eyelid'][1] * zone_(ZN['eyelid'][2], ZN['eyelid'][3]), ZN['eyelid'][0])
    tint(ZN['undereye'][1] * zone_(ZN['undereye'][2], ZN['undereye'][3]), ZN['undereye'][0])
    tint(ZN['mouthring'][1] * gauss(X ** 2 + (Z - (ez + ZN['mouthring'][2][1])) ** 2, ZN['mouthring'][3]) * frontm, ZN['mouthring'][0])
    tint(ZN['ear'][1] * ear, ZN['ear'][0])
    m1_ = blur(rng.random((N, N)), 18); m1_ = (m1_ - m1_.mean()) / (m1_.std() + 1e-6); m2_ = blur(rng.random((N, N)), 5); m2_ = (m2_ - m2_.mean()) / (m2_.std() + 1e-6)
    col *= (1 + S2['mottle'][0] * m1_ * msk + S2['mottle'][1] * m2_ * msk)[..., None]
    lum_ = col.mean(2, keepdims=True); col = np.clip(lum_ + (col - lum_) * (1 + S2['warm']), 0, 255)      # light scattered under the skin reads paler; a little more colour in the paint keeps it warm
# freckles (3D cell hash)
cs = 0.0028
ci = np.floor(pos / cs).astype(np.int64)
def hfr(a, b, c_):
    h_ = np.sin(ci[..., 0] * a + ci[..., 1] * b + ci[..., 2] * c_) * 43758.5453; return h_ - np.floor(h_)
r1 = hfr(127.1, 311.7, 74.7); r2 = hfr(269.5, 183.3, 246.1); r3 = hfr(113.5, 271.9, 124.6)
cc = (ci + 0.5) * cs
cc[..., 0] += (r1 - .5) * cs * .7; cc[..., 2] += (r2 - .5) * cs * .7; cc[..., 1] += (r3 - .5) * cs * .7
d = np.sqrt(((pos - cc) ** 2).sum(-1))
zone = np.clip(gauss((ax - (ex + 0.004)) ** 2 + (Z - (ez - 0.028)) ** 2, 0.024) + gauss(X ** 2 + (Z - (ez - 0.022)) ** 2, 0.014), 0, 1) * frontm
fr = (d < cs * (0.16 + 0.2 * r3)) * (r3 < zone * 0.9)
tint(C['freckle'] * blur(fr.astype(np.float32), 0.7), (170, 122, 96))
# brows
t = (ax - ex + 0.022) / 0.05
BZ_, BTH_ = (C['step3b']['brow_z'], C['step3b']['brow_th']) if 'shape5' in sys.argv else (0.0150, 0.0058)
BA_, BT_, BN_ = (C['step3']['brow_arch'], C['step3']['brow_tail_drop'], C['step3']['brow_thin']) if 'step3' in sys.argv else (0.0020, 0.008, 0.68)      # straighter, fuller brows in step 3 (the reference's brows are flatter and keep their thickness further out)
zc = ez + BZ_ - (C['brow_drop'] if 'shape3' in sys.argv else 0.0) + BA_ * np.sin(np.pi * 0.5 * np.clip(t / 0.62, 0, 1)) - BT_ * np.clip((t - 0.62) / 0.38, 0, 1)
th = BTH_ * (1 - BN_ * np.clip(t, 0, 1))
brow = np.clip(1 - np.abs(Z - zc) / th, 0, 1) * (t > 0) * (t < 1) * frontm
brow = np.clip(blur(brow, 1.2) * 1.5, 0, 1) * (0.75 + 0.25 * rng.random((N, N)))
tint((C['brow2']['base'] if 'brows2' in sys.argv else 0.85) * brow, C['brow'])      # with hair-stroke brows the painted band is only the faint skin tone under the hairs
if 'shape5' in sys.argv:
    cr_ = np.clip(1 - np.abs(Z - (ez + 0.0105 - 0.004 * ((ax - ex) / 0.016) ** 2)) / C['step3b']['crease_w'], 0, 1) * np.clip(1 - np.abs(ax - ex) / 0.018, 0, 1) ** 0.5 * frontm
    tint(C['step3b']['crease_dark'] * blur(cr_.astype(np.float32), 1.0), C['step3b']['crease_col'])
if C.get('wrinkles', 0):                                       # age lines: forehead, between the brows, crow's feet, under the eyes, nose-to-mouth
    def seg(x0, z0, x1, z1, w=0.0007):
        dx, dz = x1 - x0, z1 - z0; t_ = np.clip(((ax - x0) * dx + (Z - z0) * dz) / (dx * dx + dz * dz), 0, 1)
        return np.clip(1 - np.hypot(ax - (x0 + dx * t_), Z - (z0 + dz * t_)) / w, 0, 1)
    wr = np.zeros((N, N), np.float32)
    for k_, zz in enumerate((0.034, 0.044, 0.055)): wr = np.maximum(wr, np.clip(1 - np.abs(Z - (ez + zz + 0.0015 * np.sin(ax * 180 + k_))) / 0.0007, 0, 1) * (ax < 0.050 - 0.006 * k_))
    wr = np.maximum(wr, seg(0.006, ez + 0.014, 0.007, ez + 0.026))
    for a_ in (30, 2, -28): wr = np.maximum(wr, seg(ex + 0.019, ez + 0.0005, ex + 0.019 + 0.010 * math.cos(math.radians(a_)), ez + 0.0005 + 0.010 * math.sin(math.radians(a_)), 0.0006))
    wr = np.maximum(wr, seg(ex - 0.012, ez - 0.013, ex + 0.004, ez - 0.0165)); wr = np.maximum(wr, seg(ex + 0.004, ez - 0.0165, ex + 0.015, ez - 0.012))
    wr = np.maximum(wr, seg(0.017, ez - 0.046, 0.031, ez - 0.082, 0.0010)); wr = np.maximum(wr, seg(0.026, ez - 0.090, 0.029, ez - 0.108, 0.0008))
    tint(C['wrinkles'] * blur(wr * frontm, 0.8), tuple(c_ * 0.55 for c_ in C['skin']))
# painted scalp (hairline) so no bare skin shows under the hair shells
hcy0 = HP[:, 1].mean()
lobe0 = HP[(HP[:, 0] > 0.86 * earx)]; lobe0 = lobe0[lobe0[:, 2].argmin()]
phi = np.degrees(np.arctan2(ax, -(Y - hcy0)))
phi_e0 = math.degrees(math.atan2(abs(lobe0[0]), -(lobe0[1] - hcy0))) - 6
hl_z = np.where(phi < phi_e0, ez + C['hairline'] - 0.004 - 0.030 * np.clip((phi - 45) / np.maximum(phi_e0 - 45, 1), 0, 1), zchin + 0.02)
sc = np.clip((Z - hl_z) / 0.007 + 0.5 + 0.5 * (rng.random((N, N)) - .5), 0, 1) * msk * (ax < 0.9 * earx) * (Z > zchin + 0.01)
streak = blur(rng.random((N, N)), 0.8)
hc = np.array(C['hair_mid'], np.float32) * (0.82 + 0.3 * streak)[..., None]
col = col * (1 - sc[..., None]) + hc * sc[..., None]
# lips
lm = blur(lipm, 1.5) * msk
tint(0.9 * lm, C['lips'])
col = np.clip(col, 0, 255)
rough = np.full((N, N), C['skin_rough'], np.float32)
rough = rough * (1 - lm) + C['lip_rough'] * lm
rough -= 0.08 * nz + 0.05 * gauss(X ** 2 + (Z - (ez + 0.045)) ** 2, 0.03) * frontm
if SKIN2:      # oilier and smoother: nose, forehead, eyelids, chin; drier cheeks
    R2 = C['skin2']['rough']; rough = np.full((N, N), R2['base'], np.float32)
    for w_, v_ in ((gauss(X ** 2 + (Z - (ez + 0.040)) ** 2, 0.028) * frontm, R2['forehead']), (nz, R2['nose']), (gauss((ax - ex) ** 2 + (Z - (ez + 0.006)) ** 2, 0.009) * frontm, R2['eyelid']), (gauss(X ** 2 + (Z - (zchin + 0.02)) ** 2, 0.014) * frontm, R2['chin'])): rough = rough * (1 - w_) + v_ * w_
    rough = rough * (1 - lm) + C['lip_rough'] * lm; rough += R2['noise'] * (blur(rng.random((N, N)), 2) - 0.5) * 2
# dilate over seams
valid = msk.copy()
for it in range(8):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(valid, (dy, dx), (0, 1)); add = sh & ~valid
        col[add] = np.roll(col, (dy, dx), (0, 1))[add]; rough[add] = np.roll(rough, (dy, dx), (0, 1))[add]; valid |= add
col[~valid] = C['skin']
Image.fromarray(col.astype(np.uint8)).save(OUT + 'tex/skin_color.jpg', quality=90)
orm = np.zeros((N, N, 3), np.uint8); orm[..., 0] = 255; orm[..., 1] = (np.clip(rough, 0, 1) * 255).astype(np.uint8)
Image.fromarray(orm).save(OUT + 'tex/skin_orm.jpg', quality=90)
def normal_from_height(h, s):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * s; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * s
    n = np.dstack([-gx, gy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * .5 + .5) * 255).astype(np.uint8)
pore = blur(rng.random((1024, 1024)), 1.1)
if C.get('sculpt', 0):                                         # fine sculpt in the normal map: lip creases and border, philtrum, eyelid crease, under-eye line, nostril rim
    def segS(x0, z0, x1, z1, w):
        dx, dz = x1 - x0, z1 - z0; t_ = np.clip(((ax - x0) * dx + (Z - z0) * dz) / (dx * dx + dz * dz), 0, 1); return np.clip(1 - np.hypot(ax - (x0 + dx * t_), Z - (z0 + dz * t_)) / w, 0, 1)
    FD = C['sculpt_detail']; hS = np.zeros((N, N), np.float32); lm_ = blur(lipm * msk, 1.2)
    hS += FD['lip_crease'] * lm_ * (0.5 + 0.5 * np.sin(ax * 2600 + 6 * blur(rng.random((N, N)), 6)))
    hS += FD['lip_border'] * np.clip(blur(lipm * msk, 1.5) - blur(lipm * msk, 5), 0, 1) * 4
    hS -= FD['philtrum'] * np.exp(-ax ** 2 / (2 * 0.003 ** 2)) * ((Z > ltS) & (Z < znS - 0.010))
    hS -= FD['lid_crease'] * np.clip(1 - np.abs(Z - (ez + 0.0105 - 0.004 * ((ax - ex) / 0.016) ** 2)) / 0.0009, 0, 1) * (np.abs(ax - ex) < 0.017)
    hS -= FD['under_eye'] * np.clip(1 - np.abs(Z - (ez - 0.0125 + 0.003 * ((ax - ex) / 0.015) ** 2)) / 0.0012, 0, 1) * (np.abs(ax - ex) < 0.015)
    hS -= FD['nostril'] * segS(0.012, znS - 0.0075, 0.0175, znS - 0.004, 0.0011) + FD['nasolabial'] * segS(0.0175, znS - 0.004, 0.027, mzS + 0.004, 0.0022)
    hS = np.asarray(Image.fromarray(np.float32(blur(np.clip(hS * 0.5 + 0.5, 0, 1) * frontm + 0.5 * (1 - frontm), 0.8))).resize((1024, 1024), Image.BILINEAR), np.float32)
    pore = pore * (0.05 / C['skin_normal']) + (hS - 0.5) * 2 * C['sculpt']
Image.fromarray(normal_from_height(pore, 2.2)).save(OUT + 'tex/skin_normal.jpg', quality=92)
skin_m = mat('skin', base=OUT + 'tex/skin_color.jpg', orm=OUT + 'tex/skin_orm.jpg', nrm=OUT + 'tex/skin_normal.jpg', nstr=C['skin_normal'])
for a_ in sys.argv:
    if a_.startswith('sss:'): C['skin2']['sss_scale'] = float(a_[4:]); C['skin2']['sss'] = 0.0 if float(a_[4:]) == 0 else 1.0
if 'skin2' in sys.argv:      # light that enters the skin and comes out nearby, redder and wider than green and blue
    S2 = C['skin2']; bs_ = skin_m.node_tree.nodes['Principled BSDF']
    try: bs_.subsurface_method = 'RANDOM_WALK_SKIN'
    except Exception as e_: print('SKIN subsurface method', e_)
    bs_.inputs['Subsurface Weight'].default_value = S2['sss']; bs_.inputs['Subsurface Radius'].default_value = S2['sss_radius']; bs_.inputs['Subsurface Scale'].default_value = S2['sss_scale']
    bs_.inputs['Subsurface Anisotropy'].default_value = S2['sss_aniso']; bs_.inputs['IOR'].default_value = S2['ior']; print('SKIN subsurface scale %.4f m, radius %s' % (S2['sss_scale'], S2['sss_radius']))
body, bidx = mk('body', keepf); body.data.materials.append(skin_m)
FACE = [(body, bidx)]

# ----------------------------------------------------------------- eyes
EYES2 = 'eyes2' in sys.argv
E = 512
yy, xx = np.mgrid[0:E, 0:E]; u = (xx + .5) / E - .5; v = (yy + .5) / E - .5
rr = np.sqrt(u * u + v * v); ang = np.arctan2(v, u)
eye = np.zeros((E, E, 3), np.float32) + np.array((246, 243, 241), np.float32)
eye -= np.clip((rr - 0.38) / 0.12, 0, 1)[..., None] * np.array((14, 40, 40), np.float32)   # pink toward lids
ir, pr = C['iris_r'], C['pupil_r']
fib = np.interp((ang + np.pi) / (2 * np.pi) * 360, np.arange(361), blur(rng.random((1, 361)).repeat(4, 0), 0.8)[0])
k = np.clip((rr - pr) / (ir - pr), 0, 1)
iris = np.array(C['iris'], np.float32)[None, None] * (0.72 + 0.5 * fib * (0.4 + 0.6 * k))[..., None]
iris = iris * (1 - 0.25 * (1 - k))[..., None]                         # warmer darker ring at pupil
iris *= (1 - 0.75 * np.clip((k - 0.82) / 0.18, 0, 1))[..., None]       # limbal ring
m_ir = np.clip((ir - rr) / 0.006, 0, 1)[..., None]
eye = eye * (1 - m_ir) + iris * m_ir
m_p = np.clip((pr - rr) / 0.006, 0, 1)[..., None]; eye = eye * (1 - m_p) + 8 * m_p
if not EYES2:
    hl = gauss((u + 0.085) ** 2 + (v + 0.10) ** 2, 0.026)[..., None]; eye = eye * (1 - hl) + 255 * hl   # baked catchlight
    hl2 = 0.5 * gauss((u - 0.07) ** 2 + (v - 0.09) ** 2, 0.014)[..., None]; eye = eye * (1 - hl2) + 235 * hl2
Image.fromarray(np.clip(eye, 0, 255).astype(np.uint8)).save(OUT + 'tex/eye.png')
eye_m = mat('eye', base=OUT + 'tex/eye.png', rough=0.08, coat=1.0)
def face_out(ob_, cen_):      # make every face of an open or closed shell point away from cen_
    import bmesh
    bm_ = bmesh.new(); bm_.from_mesh(ob_.data); bm_.faces.ensure_lookup_table(); bm_.normal_update()
    inward_ = sum(1 for f_ in bm_.faces if f_.normal.dot(f_.calc_center_median() - Vector(tuple(cen_))) < 0)
    if inward_ > len(bm_.faces) / 2: bmesh.ops.reverse_faces(bm_, faces=bm_.faces)
    print('FACE_OUT', ob_.name, 'inward', inward_, 'of', len(bm_.faces))
    bm_.to_mesh(ob_.data); bm_.free(); ob_.data.update()
if EYES2:      # layered eye: tinted sclera with lid shadow and veins, flat recessed iris under a clear bulged cornea, wet line on the lower lid, both eyes aimed at one point
    E2 = C['eye2']; ir2 = 0.5 * 0.0  # set per eye below (texture radius depends on the ball radius)
    ballR = []
    for side in ('l', 'r'):
        vi_ = sorted(set(v_ for f_ in G['helper-%s-eye' % side] for v_, _t in f_)); P_ = B[vi_]; ballR.append(float(np.abs(P_[:, 2] - P_[:, 2].mean()).max()))      # height, not width: a head-width slider stretches the eye helper sideways
    R0 = float(np.mean(ballR))
    vi0_ = sorted(set(v_ for f_ in G['helper-l-eye'] for v_, _t in f_)); c0_ = B[vi0_].mean(0); Pb_t = B[np.array(bidx)]; dd_t = np.linalg.norm(Pb_t - c0_, axis=1) - R0; rg_t = Pb_t[(dd_t > -0.0008) & (dd_t < 0.0016) & ((Pb_t - c0_)[:, 1] < -0.2 * R0)] - c0_
    W0_ = float(rg_t[:, 0].max() - rg_t[:, 0].min()); sth = (E2['iris_mm'] / 2) / E2['front_mm'] if E2.get('iris_mm') else (E2['iris_frac'] * W0_ / 2) / (E2['front_frac'] * W0_); irT = 0.5 * sth; print('EYE ball radius %.2f mm, iris %.2f mm, texture iris radius %.3f (was %.3f)' % (R0 * 1000, E2['iris_r'] * 1000, irT, C['iris_r']))
    sc_ = np.array(E2['sclera'], np.float32); ey2 = np.zeros((E, E, 3), np.float32) + sc_
    vein = blur(rng.random((E // 4, E // 4)), 1.2); vein = np.kron(vein, np.ones((4, 4)))[:E, :E]; vein = np.clip((vein - 0.55) * 4, 0, 1) * np.clip((rr - 0.30) / 0.15, 0, 1) * (0.4 + 0.6 * np.clip(np.abs(u) / 0.4, 0, 1))
    ey2 = ey2 * (1 - E2['veins'] * vein)[..., None] + np.array((200, 90, 90), np.float32) * (E2['veins'] * vein)[..., None]
    ey2 = ey2 * (1 - E2['corner_pink'] * np.clip((np.abs(u) - 0.20) / 0.25, 0, 1))[..., None] + np.array((205, 140, 135), np.float32) * (E2['corner_pink'] * np.clip((np.abs(u) - 0.20) / 0.25, 0, 1))[..., None]
    ey2 *= (1 - E2['lid_dark'] * np.clip((-v - 0.02) / 0.30, 0, 1) ** 0.8)[..., None]      # the upper lid and lashes shade the top of the eyeball
    ey2 *= (1 - 0.18 * np.clip((v - 0.30) / 0.18, 0, 1))[..., None]
    k2 = np.clip((rr - pr * irT / ir) / (irT - pr * irT / ir), 0, 1); pr2 = pr * irT / ir
    iris2 = np.array(C['iris'], np.float32)[None, None] * (0.72 + 0.5 * fib * (0.4 + 0.6 * k2))[..., None]; iris2 = iris2 * (1 - 0.25 * (1 - k2))[..., None]
    iris2 *= (1 - 0.70 * np.clip((k2 - 0.80) / 0.20, 0, 1) ** 1.5)[..., None]       # soft dark limbus
    m2 = np.clip((irT - rr) / 0.010, 0, 1)[..., None]; ey2 = ey2 * (1 - m2) + iris2 * m2
    mp2 = np.clip((pr2 - rr) / 0.005, 0, 1)[..., None]; ey2 = ey2 * (1 - mp2) + 6 * mp2
    Image.fromarray(np.clip(ey2, 0, 255).astype(np.uint8)).save(OUT + 'tex/eye2.png')
    eye2_m = mat('eye2', base=OUT + 'tex/eye2.png', rough=0.35)
    cm_ = bpy.data.materials.new('cornea'); cm_.use_nodes = True; nt_ = cm_.node_tree; nt_.nodes.remove(nt_.nodes['Principled BSDF']); o_ = nt_.nodes['Material Output']
    # clear wet shell: mostly see-through, a mirror-like reflection that grows at grazing angles (no refraction: a glass shell made the denoiser blur the iris into a milky disc)
    gl_ = nt_.nodes.new('ShaderNodeBsdfGlossy'); gl_.inputs['Roughness'].default_value = 0.0; fr_ = nt_.nodes.new('ShaderNodeFresnel'); fr_.inputs['IOR'].default_value = E2['cornea_ior']
    tr_ = nt_.nodes.new('ShaderNodeBsdfTransparent'); mf_ = nt_.nodes.new('ShaderNodeMixShader'); nt_.links.new(fr_.outputs[0], mf_.inputs[0]); nt_.links.new(tr_.outputs[0], mf_.inputs[1]); nt_.links.new(gl_.outputs[0], mf_.inputs[2])
    tr2_ = nt_.nodes.new('ShaderNodeBsdfTransparent'); lp_ = nt_.nodes.new('ShaderNodeLightPath'); mx_ = nt_.nodes.new('ShaderNodeMixShader')
    nt_.links.new(lp_.outputs['Is Shadow Ray'], mx_.inputs[0]); nt_.links.new(mf_.outputs[0], mx_.inputs[1]); nt_.links.new(tr2_.outputs[0], mx_.inputs[2]); nt_.links.new(mx_.outputs[0], o_.inputs['Surface'])
    wm_ = bpy.data.materials.new('eye_wet'); wm_.use_nodes = True; wb_ = wm_.node_tree.nodes['Principled BSDF']; wb_.inputs['Base Color'].default_value = (0.95, 0.80, 0.78, 1); wb_.inputs['Roughness'].default_value = 0.03; wb_.inputs['Alpha'].default_value = 0.55
    gz_ = np.array(E2['gaze']) + np.array((0, 0, EL[2]))
    for side in ('l', 'r'):
        vi_ = sorted(set(v_ for f_ in G['helper-%s-eye' % side] for v_, _t in f_)); P_ = B[vi_]; c_ = P_.mean(0); R_ = float(np.abs(P_[:, 2] - c_[2]).max())
        d_ = gz_ - c_; d_ /= np.linalg.norm(d_); sgn_ = 1 if c_[0] > 0 else -1
        a_ = math.radians(E2['kappa']); d_ = d_ * math.cos(a_) + np.array((sgn_, 0, 0)) * math.sin(a_); d_ /= np.linalg.norm(d_)      # the iris axis points a few degrees outward of the line of sight
        e1_ = np.cross(d_, (0, 0, 1)); e1_ /= np.linalg.norm(e1_); e2_ = np.cross(e1_, d_)
        if e2_[2] < 0: e2_ = -e2_
        if (e1_ @ np.array((1, 0, 0))) < 0: e1_ = -e1_
        # the lid opening sets the eye's proportions: iris 11.75 mm and front curvature 12 mm for a 29 mm opening (measured eyes); the ball keeps its old shape further back, where the lids rest
        bv0_ = np.array(bidx); Pb0_ = B[bv0_]; dd0_ = np.linalg.norm(Pb0_ - c_, axis=1) - R_; ring0_ = Pb0_[(dd0_ > -0.0008) & (dd0_ < 0.0016) & (((Pb0_ - c_) @ d_) > 0.2 * R_)] - c_
        Wop_ = float((ring0_ @ e1_).max() - (ring0_ @ e1_).min()); mid_ = ring0_[np.abs(ring0_ @ e1_ - np.median(ring0_ @ e1_)) < 0.002]; Hop_ = float((mid_ @ e2_).max() - (mid_ @ e2_).min()) if len(mid_) else 0.0
        # iris and front curvature at real sizes when set (the lid opening changes with the face sliders)
        irr_ = E2['iris_mm'] / 2000 if E2.get('iris_mm') else E2['iris_frac'] * Wop_ / 2; Rf_ = E2['front_mm'] / 1000 if E2.get('front_mm') else E2['front_frac'] * Wop_; cf_ = c_ + d_ * (R_ - Rf_); b1_, b2_ = (math.radians(a__) for a__ in E2['blend'])
        print('EYE %s: lid opening %.1f mm wide, old ball %.1f mm, iris %.1f mm (was %.1f), front curvature radius %.1f mm' % (side, Wop_ * 1000, 2000 * R_, 2000 * irr_, 2000 * E2['iris_r'], Rf_ * 1000))
        E2 = dict(E2, iris_r=irr_)
        def surf_(th, rad_):      # front: a small sphere; back: the old ball; smooth blend between
            pf_ = cf_ + Rf_ * (math.cos(th) * d_ + math.sin(th) * rad_); po_ = c_ + R_ * (math.cos(th) * d_ + math.sin(th) * rad_)
            w_ = min(1.0, max(0.0, (th - b1_) / (b2_ - b1_))); w_ = w_ * w_ * (3 - 2 * w_); return pf_ * (1 - w_) + po_ * w_
        th_i = math.asin(E2['iris_r'] / Rf_); NL, NA = E2['segs']; vs_ = []; uvs_ = []; fs_ = []
        for j in range(NL + 1):
            th = math.pi * j / NL
            for k in range(NA):
                ph = 2 * math.pi * k / NA; rad_ = (math.cos(ph) * e1_ + math.sin(ph) * e2_)
                if th < th_i: p_ = cf_ + Rf_ * math.cos(th_i) * d_ + Rf_ * math.sin(th_i) * (th / th_i) * rad_; s_ = math.sin(th_i) * th / th_i      # flat iris, set back behind the cornea
                else: p_ = surf_(th, rad_); s_ = math.sin(th) if th < math.pi / 2 else 1.0
                vs_.append(tuple(p_)); uvs_.append((0.5 + 0.5 * s_ * math.cos(ph), 0.5 + 0.5 * s_ * math.sin(ph)))
        for j in range(NL):
            for k in range(NA): a0 = j * NA + k; b0 = j * NA + (k + 1) % NA; fs_.append([a0, a0 + NA, b0 + NA, b0])
        ob = mk_raw('eye_' + side, vs_, fs_, uvs_, bone='head'); ob.data.materials.append(eye2_m); face_out(ob, c_)
        for p in ob.data.polygons: p.use_smooth = True
        # cornea: a cap of a 7.8 mm sphere that meets the eyeball at the limbus and bulges in front of it
        Rc = E2['cornea_R'] * Rf_ / 0.012; lim_ = math.sqrt(Rf_ ** 2 - E2['iris_r'] ** 2); cc_ = cf_ + d_ * (lim_ - math.sqrt(Rc ** 2 - E2['iris_r'] ** 2)); th_c = math.asin(min(0.999, (E2['iris_r'] + 0.0004) / Rc)); cv_ = []; cf_ = []
        for j in range(17):
            th = th_c * j / 16
            for k in range(NA): ph = 2 * math.pi * k / NA; cv_.append(tuple(cc_ + (Rc + E2['cornea_lift']) * (math.cos(th) * d_ + math.sin(th) * (math.cos(ph) * e1_ + math.sin(ph) * e2_))))
        for j in range(16):
            for k in range(NA): a0 = j * NA + k; b0 = j * NA + (k + 1) % NA; cf_.append([a0, b0, b0 + NA, a0 + NA])
        co_ = mk_raw('cornea_' + side, cv_, cf_, None, bone='head'); co_.data.materials.append(cm_); face_out(co_, cc_)
        co_.hide_render = 'nocornea' in sys.argv
        for p in co_.data.polygons: p.use_smooth = True
        print('EYE %s: cornea apex %.2f mm in front of the ball' % (side, 1000 * ((cc_ + Rc * d_ - c_) @ d_ - R_)))
        E2 = C['eye2']
        # wet line: a thin glossy tube where the lower lid meets the eyeball, moving with the lid
        bv_ = np.array(bidx); Pb_ = B[bv_]; dd_ = np.linalg.norm(Pb_ - c_, axis=1) - R_; fwd_ = (Pb_ - c_) @ d_
        ring_ = np.where((dd_ > -0.0008) & (dd_ < 0.0016) & (fwd_ > 0.45 * R_))[0]
        if len(ring_) > 8:
            rel_ = Pb_[ring_] - c_; an_ = np.arctan2(rel_ @ e2_, rel_ @ e1_); low_ = ring_[(an_ < -0.25) & (an_ > -math.pi + 0.25)]; an_l = np.arctan2((Pb_[low_] - c_) @ e2_, (Pb_[low_] - c_) @ e1_)
            bins_ = np.linspace(an_l.min(), an_l.max(), 22); path_ = []; pid_ = []
            for b0_, b1_ in list(zip(bins_[:-1], bins_[1:]))[4:-3]:      # not into the corners, where the lids pull away from the eyeball in a smile
                sel_ = low_[(an_l >= b0_) & (an_l <= b1_)]
                if len(sel_): q_ = sel_[np.argmin(np.abs(dd_[sel_]))]; dir_ = (B[bv_[q_]] - c_) / np.linalg.norm(B[bv_[q_]] - c_); path_.append(c_ + dir_ * (R_ + E2['wet_lift'] + E2['wet_r'])); pid_.append(int(bv_[q_]))
            wv_ = []; wf_ = []; wi_ = []; NR = 6
            for t_, (pp_, bi_) in enumerate(zip(path_, pid_)):
                tg_ = (path_[min(t_ + 1, len(path_) - 1)] - path_[max(t_ - 1, 0)]); tg_ /= np.linalg.norm(tg_) + 1e-9; n1_ = (pp_ - c_) / np.linalg.norm(pp_ - c_); n2_ = np.cross(tg_, n1_)
                for k in range(NR): ph = 2 * math.pi * k / NR; wv_.append(tuple(pp_ + E2['wet_r'] * (math.cos(ph) * n1_ + math.sin(ph) * n2_))); wi_.append(bi_)
            for t_ in range(len(path_) - 1):
                for k in range(NR): a0 = t_ * NR + k; b0 = t_ * NR + (k + 1) % NR; wf_.append([a0, b0, b0 + NR, a0 + NR])
            wt_ = mk_raw('eye_wet_' + side, wv_, wf_, None, bone='head'); wt_.data.materials.append(wm_); FACE.append((wt_, wi_))
            face_out(wt_, np.mean(path_, 0))
            for p in wt_.data.polygons: p.use_smooth = True
            print('EYE %s: wet line along %d points of the lower lid' % (side, len(path_)))
        else: print('EYE %s: lid ring not found, no wet line' % side)
for side in (() if EYES2 else ('l', 'r')):
    ob, idx = mk('eye_' + side, G['helper-%s-eye' % side])
    P = B[idx]; c = P.mean(0); r = np.abs(P - c).max()
    uvl = ob.data.uv_layers[0].data
    for lp in ob.data.loops:
        dd = (np.array(ob.data.vertices[lp.vertex_index].co) - c) / r
        uvl[lp.index].uv = (0.5 + dd[0] * 0.5, 0.5 + dd[2] * 0.5)
    ob.data.materials.append(eye_m); FACE.append((ob, idx))
LW, LH = 256, 64
la = Image.new('L', (LW, LH), 0); ldr = ImageDraw.Draw(la)
ldr.rectangle((0, LH - 26, LW, LH), fill=255)                        # root band = lash line
for x in np.arange(2, LW, 4.0):
    Ln = LH * (0.58 + 0.34 * rng.random()) * C.get('lash_len', 1.0); sl = (rng.random() - .5) * 10
    for sgi in range(8):
        t0, t1 = sgi / 8, (sgi + 1) / 8
        ldr.line((x + sl * t0, LH - 1 - Ln * t0, x + sl * t1, LH - 1 - Ln * t1), fill=255, width=max(2, int(round(6 * (1 - t0)))))
li = np.zeros((LH, LW, 4), np.uint8); li[..., :3] = (22, 16, 12); li[..., 3] = np.asarray(la)
if EYES2:      # two cards in one image: upper lashes (bottom half) thin, tapered, curved and clumped; lower lashes (top half) short, sparse and lighter. Card coordinate c runs from the lid (0) outward (1); the first part of each card sits inside the lid.
    LW2, LH2 = 512, 128; lu = Image.new('L', (LW2, LH2 * 2), 0); ld_ = ImageDraw.Draw(lu); cl_ = Image.new('RGB', (LW2, LH2 * 2), (34, 26, 21)); cd_ = ImageDraw.Draw(cl_)
    rowU = lambda c: 2 * LH2 - 1 - c * LH2; rowL = lambda c: LH2 * (1 - c)
    ld_.rectangle((0, rowU(C['step3']['lash_root'] if 'step3' in sys.argv else 0.20), LW2, 2 * LH2), fill=C['step3']['lash_band'] if 'step3' in sys.argv else 235); ld_.rectangle((0, rowL(0.42), LW2, rowL(0.33)), fill=150)
    x_ = 1.0
    while x_ < LW2:
        n_ = 2 + int(rng.random() * 2); tipx = x_ + 5 + rng.random() * 8; Lc = (0.55 + 0.40 * rng.random()) * C.get('lash_len', 1.0)
        for q_ in range(n_):
            rx = x_ + q_ * (3 + rng.random() * 3); ts = np.linspace(0, 1, 10)
            pts = [(rx + (tipx - rx) * t ** 1.5 + 6 * t * t, rowU(0.12 + Lc * t)) for t in ts]
            for (xa, ya), (xb, yb), t in zip(pts[:-1], pts[1:], ts[:-1]): ld_.line((xa, ya, xb, yb), fill=int(255 * (1 - 0.4 * t)), width=max(2, int(round(5 * (1 - t)))))
        x_ += 9 + rng.random() * 9
    x_ = 4.0
    while x_ < LW2:
        Lc = 0.12 + 0.22 * rng.random(); sl = (rng.random() - 0.5) * 10; ts = np.linspace(0, 1, 6)
        for t0, t1 in zip(ts[:-1], ts[1:]): ld_.line((x_ + sl * t0, rowL(0.35 + Lc * t0), x_ + sl * t1, rowL(0.35 + Lc * t1)), fill=int(230 * (1 - 0.4 * t0)), width=max(2, int(round(3 * (1 - t0)))))
        x_ += 10 + rng.random() * 14
    cd_.rectangle((0, 0, LW2, LH2), fill=(74, 60, 50))
    li = np.zeros((LH2 * 2, LW2, 4), np.uint8); li[..., :3] = np.asarray(cl_); li[..., 3] = np.asarray(lu)
Image.fromarray(li, 'RGBA').save(OUT + 'tex/lash.png')
lash_m = mat('lash', base=OUT + 'tex/lash.png', rough=0.6, alpha_clip=True)
lf = []; VTL = list(VT)
for k in G:
    if 'eyelashes' not in k: continue
    tt = np.array([VT[t] for f in G[k] for _, t in f]); mn, mx = tt.min(0), tt.max(0)
    up = k.endswith('2')
    for f in G[k]:
        nf = []
        for v, t in f:
            q = (VT[t] - mn) / (mx - mn)
            vv_ = q[1] if up else (1 - q[1]) * 0.55 + 0.0
            if not up: vv_ = 0.12 + (1 - q[1]) * 0.88
            vv2_ = (1 - (1 - vv_) if up else vv_)
            if EYES2: vv2_ = 0.5 * q[1] if up else 0.5 + 0.5 * (0.12 + (1 - q[1]) * 0.88)
            VTL.append((q[0], vv2_)); nf.append((v, len(VTL) - 1))
        lf.append(nf)
VT = np.array(VTL)
lash, lidx = mk('lashes', lf); lash.data.materials.append(lash_m); FACE.append((lash, lidx))
from scipy.spatial import cKDTree as cKDTree_
if 'brows2' in sys.argv:      # eyebrows as hair strokes: head hairs point up, body hairs sweep out and up, tail hairs lie down; lower and upper rows lean toward the middle line
    from scipy.interpolate import griddata
    BW = C['brow2']; ax0, ax1, z0b, z1b = ex + BW['domain'][0], ex + BW['domain'][1], ez + BW['domain'][2], ez + BW['domain'][3]; TW, TH = BW['tex']
    def zc_(t_): return ez + BZ_ - (C['brow_drop'] if 'shape3' in sys.argv else 0.0) + BA_ * math.sin(math.pi * 0.5 * min(1, max(0, t_ / 0.62))) - BT_ * min(1, max(0, (t_ - 0.62) / 0.38))
    def th_(t_): return BTH_ * (1 - BN_ * min(1, max(0, t_)))
    def ang_(t_): return float(np.interp(t_, [a_[0] for a_ in BW['angle']], [a_[1] for a_ in BW['angle']]))
    bvb_ = np.array(bidx); Pbb_ = B[bvb_]
    for side, sg in (('l', 1), ('r', -1)):
        rb_ = np.random.default_rng(C['seed'] * 31 + (7 if sg > 0 else 11)); SS = 2; img_ = Image.new('RGBA', (TW * SS, TH * SS), (0, 0, 0, 0)); dr_ = ImageDraw.Draw(img_)
        mm2px = TW * SS / ((ax1 - ax0) * 1000); toimg = lambda a__, z__: ((a__ - ax0) / (ax1 - ax0) * TW * SS, (z1b - z__) / (z1b - z0b) * TH * SS)
        n_done = 0
        while n_done < BW['hairs']:
            t_ = rb_.random(); dens_ = 0.45 if t_ < 0.12 else (0.6 if t_ > 0.78 else 1.0)
            if rb_.random() > dens_: continue
            off_ = rb_.uniform(-0.95, 0.95); a_ = ex - 0.022 + 0.05 * t_; z_ = zc_(t_) + off_ * th_(t_)
            an_ = math.radians(ang_(t_) - BW['cross'] * off_ + rb_.uniform(-BW['jitter'], BW['jitter'])); L_ = float(np.interp(t_, [0, 0.35, 1], BW['len'])) * rb_.uniform(0.75, 1.2)
            col_ = tuple(int(min(255, c__ * rb_.uniform(*BW['tones']))) for c__ in C['brow']); al_ = rb_.uniform(*BW['alpha'])
            pts_ = []
            for k_ in range(7):
                u_ = k_ / 6; bend_ = -0.18 * u_ * u_ * (1 if ang_(t_) > 0 else -1)      # hairs curve back toward the brow line near their tips
                pts_.append(toimg(a_ + 0.001 * L_ * u_ * math.cos(an_ + bend_), z_ + 0.001 * L_ * u_ * math.sin(an_ + bend_)))
            for k_ in range(6):
                w_ = max(1, int(round(BW['width_mm'] * mm2px * (1.3 - 0.9 * k_ / 6)))); dr_.line((*pts_[k_], *pts_[k_ + 1]), fill=col_ + (int(255 * al_ * (1 - 0.55 * k_ / 6)),), width=w_)
            n_done += 1
        img_ = img_.resize((TW, TH), Image.LANCZOS); img_.save(OUT + 'tex/brow_%s.png' % side)
        # the card: a grid over the brow, laid on the skin and lifted a little, each corner tied to the nearest skin vertex so it moves with brow expressions
        from mathutils.bvhtree import BVHTree
        if side == 'l': bod_ = FACE[0][0]; bvh_ = BVHTree.FromPolygons([tuple(v__.co) for v__ in bod_.data.vertices], [tuple(p__.vertices) for p__ in bod_.data.polygons])
        NXg, NZg = 48, 20; gv_ = []; guv_ = []; miss_ = 0
        for j_ in range(NZg + 1):
            for i_ in range(NXg + 1):
                a__ = ax0 + (ax1 - ax0) * i_ / NXg; z__ = z0b + (z1b - z0b) * j_ / NZg
                hit_, nrm_, _i, _d = bvh_.ray_cast(Vector((sg * a__, ey - 0.12, z__)), Vector((0, 1, 0)))
                if hit_ is None: miss_ += 1; hit_ = Vector((sg * a__, ey - 0.02, z__)); nrm_ = Vector((0, -1, 0))
                if nrm_.y > 0: nrm_ = -nrm_
                p__ = hit_ + nrm_ * BW['lift']; gv_.append(tuple(p__)); guv_.append(((a__ - ax0) / (ax1 - ax0), (z__ - z0b) / (z1b - z0b)))
        print('BROW %s: rays that missed the skin %d' % (side, miss_))
        gf_ = []
        for j_ in range(NZg):
            for i_ in range(NXg): a0 = j_ * (NXg + 1) + i_; q4_ = [a0, a0 + 1, a0 + NXg + 2, a0 + NXg + 1]; gf_.append(q4_ if sg > 0 else q4_[::-1])
        card_ = mk_raw('brow_' + side, gv_, gf_, guv_, bone='head')
        for p in card_.data.polygons: p.use_smooth = True
        face_out(card_, (0.0, ey + 0.06, ez))
        bm_m = mat('brow_' + side, base=OUT + 'tex/brow_%s.png' % side, rough=0.55); nt_b = bm_m.node_tree; tx_b = [n__ for n__ in nt_b.nodes if n__.type == 'TEX_IMAGE'][0]; nt_b.links.new(tx_b.outputs['Alpha'], nt_b.nodes['Principled BSDF'].inputs['Alpha'])
        card_.data.materials.append(bm_m); tree_b = cKDTree_(Pbb_); _, nn_ = tree_b.query(np.array(gv_)); FACE.append((card_, [int(bvb_[q__]) for q__ in nn_]))
        print('BROW %s: %d hairs, card %d x %d, texture %d x %d' % (side, n_done, NXg, NZg, TW, TH))
teeth_m = mat('teeth', color=C.get('teeth_color', (0.93, 0.91, 0.87)), rough=0.22)
teeth, tidx = mk('teeth', G['helper-upper-teeth'] + G['helper-lower-teeth']); teeth.data.materials.append(teeth_m); FACE.append((teeth, tidx))
up_ = set(v_ for f_ in G['helper-upper-teeth'] for v_, _t in f_)
for k_, v_ in enumerate(teeth.data.vertices): v_.co.x *= C['teeth_wide']; v_.co.y -= C['teeth_forward']; v_.co.z -= C['teeth_drop'][0 if tidx[k_] in up_ else 1]; v_.co.y += 0 if tidx[k_] in up_ else C['teeth_lower_back']      # upper row a little lower so a smile shows it; lower row tucked behind the lower lip
tu_ = np.array([v_.co[:] for k_, v_ in enumerate(teeth.data.vertices) if tidx[k_] in up_])
cen_ = tu_[np.abs(tu_[:, 0]) < 0.004]; ta_, tb_ = C['teeth_arch']; ph_ = np.linspace(0, 1.45, 50)           # own dental arch (the helper band is too narrow for a wide grin)
xs_ = ta_ * np.sin(ph_); fy_ = cen_[:, 1].min() - 0.0008 + tb_ * (1 - np.cos(ph_)); zb_ = np.full(50, cen_[:, 2].min()); zt_ = np.full(50, cen_[:, 2].max())
arc_ = np.concatenate([[0], np.cumsum(np.hypot(np.diff(xs_), np.diff(fy_)))])
TV = []; TF = []; s0_ = 0.0
for ti_, (tw_, th_, ef_, tl_) in enumerate(C['teeth_set']):
    if s0_ + tw_ > arc_[-1]: break
    sc_ = s0_ + tw_ / 2; s0_ += tw_
    xc = float(np.interp(sc_, arc_, xs_)); yc = float(np.interp(sc_, arc_, fy_)); x2 = float(np.interp(sc_ + 0.001, arc_, xs_)); y2 = float(np.interp(sc_ + 0.001, arc_, fy_))
    tx, ty = (x2 - xc) / math.hypot(x2 - xc, y2 - yc), (y2 - yc) / math.hypot(x2 - xc, y2 - yc); nx_, ny_ = -ty, tx                    # normal points into the mouth
    zt1_ = float(np.interp(xc, xs_, zt_)); zb1_ = max(float(np.interp(xc, xs_, zb_)), zt1_ - C['teeth_len']) + (1 - th_) * 0.004 + C['teeth_arc'] * (sc_ / arc_[-1]) ** 2; zb0_ = zb1_; hw = tw_ / 2 * C['teeth_gap']
    for sg in (1, -1):
        zb1_ = zb0_ + (C['teeth_asym'][ti_] if sg == -1 else 0.0)                                                              # her left side differs a little from her right
        b0 = len(TV); rows_ = ((zt1_, 1.0, 0.0, 0.0), (zb1_ + 0.0035, 1.0, 0.0, 0.55), (zb1_ + 0.0010, 0.5 + 0.5 * ef_ if ef_ < 0.7 else 0.96, 0.0, 0.9), (zb1_, ef_, 0.0005, 1.0))     # (height, width factor, set back, share of the crown tilt): rounded biting edge
        for dz_, inset, back_, tk_ in rows_:
            for a_, dp_ in ((-1.0, 0.0030), (-1.0, 0.0009), (-0.45, 0.0), (0.45, 0.0), (1.0, 0.0009), (1.0, 0.0030)):                        # back, side, curved front, side, back
                rz_ = dz_ + (0.0007 if dz_ == zb1_ and abs(a_) == 1.0 else 0)
                TV.append((sg * (xc + tx * (a_ * hw * inset - tl_ * tk_) + nx_ * (dp_ + back_)), yc + ty * (a_ * hw * inset - tl_ * tk_) + ny_ * (dp_ + back_), rz_))
        for r_ in range(3):
            for c_ in range(5):
                a0 = b0 + r_ * 6 + c_; q4 = [a0 + 1, a0, a0 + 6, a0 + 7]; TF.append(q4 if sg == 1 else q4[::-1])
        for c_ in (1, 2, 3):
            a0 = b0 + 18 + c_; q4 = [a0, a0 + 1, b0 + 18 + 4, b0 + 18 + 1] if c_ == 2 else None
        q1 = [b0 + 19, b0 + 20, b0 + 21, b0 + 22]; TF.append(q1[::-1] if sg == 1 else q1)
tup = mk_raw('teeth_up', TV, TF, None, bone='head'); tup.data.materials.append(teeth_m)
if 'teeth2' in sys.argv:      # shaded teeth: off-white, darker toward the back and up under the lip, the biting edge a little see-through grey, canines and side teeth warmer
    T3 = C['teeth3']; TVa_ = np.array(TV); yf_ = TVa_[:, 1].min(); ax_ = np.abs(TVa_[:, 0]); ze_ = np.array([TVa_[np.abs(ax_ - a_) < 0.0015, 2].min() for a_ in ax_])
    dep_ = np.clip((TVa_[:, 1] - yf_) / T3['back_depth'], 0, 1); top_ = np.clip((TVa_[:, 2] - ze_ - T3['top_from']) / 0.004, 0, 1); edg_ = np.clip(1 - (TVa_[:, 2] - ze_) / T3['edge_mm'], 0, 1)
    col3_ = np.tile(np.array(T3['enamel']), (len(TVa_), 1)); col3_ *= np.where(ax_[:, None] > T3['warm_from'], np.array(T3['warm']), 1.0)
    col3_ = col3_ * (1 - edg_[:, None] * T3['edge_mix']) + np.array(T3['edge'])[None] * (edg_[:, None] * T3['edge_mix'])
    col3_ *= (1 - T3['back_dark'] * dep_ - T3['top_dark'] * top_)[:, None]
    vc3 = tup.data.color_attributes.new('shade', 'FLOAT_COLOR', 'POINT'); c4_ = np.ones((len(TVa_), 4)); c4_[:, :3] = np.clip(col3_, 0, 1); vc3.data.foreach_set('color', c4_.ravel())
    m3 = bpy.data.materials.new('enamel'); m3.use_nodes = True; n3 = m3.node_tree; b3 = n3.nodes['Principled BSDF']; b3.inputs['Roughness'].default_value = T3['rough']
    b3.inputs['Subsurface Weight'].default_value = T3['sss']; b3.inputs['Subsurface Radius'].default_value = (1.0, 0.8, 0.6); b3.inputs['Subsurface Scale'].default_value = 0.0006
    a3 = n3.nodes.new('ShaderNodeVertexColor'); a3.layer_name = 'shade'; n3.links.new(a3.outputs['Color'], b3.inputs['Base Color']); tup.data.materials.clear(); tup.data.materials.append(m3)
    print('TEETH2: shaded %d vertices; edge %.1f mm, back %.0f mm' % (len(TVa_), T3['edge_mm'] * 1000, T3['back_depth'] * 1000))
if 'teethict' in sys.argv:      # TRIED 2026-11-14 and dropped: does not fit Marla's shallower jaw (lower gums, then roots, came through the chin). Sculpted teeth, gums and tongue from the USC ICT-FaceKit (MIT licence), placed by ict_transfer.py; the old teeth stay in the file but do not render
    T2 = C['teeth2']; MQ = np.load('/home/claude/marla/ict_mouth_%s.npz' % ('shape3' if 'shape3' in sys.argv else 'profile2') if ('profile2' in sys.argv or 'shape3' in sys.argv) else '/home/claude/marla/ict_mouth.npz'); MVq = MQ['mouth_V'].astype(np.float64); TVa_ = np.array(TV); iT_ = MQ['mouth_isT']; upT_ = MVq[iT_][MVq[iT_][:, 2] > np.median(MVq[iT_][:, 2])]
    fit_ = np.array((0.0, TVa_[:, 1].min() - upT_[:, 1].min() + 0.0005, TVa_[:, 2].min() - upT_[:, 2].min())); print('TEETH2 moved to the old teeth: %s mm' % np.round(fit_ * 1000, 1))      # front of the upper teeth where the old ones were (just behind the lips), biting edge at the old height
    MVq = MVq + fit_ + np.array(T2['offset']); anc2_ = np.array((0.0, TVa_[:, 1].min() + 0.0005, TVa_[:, 2].min() + T2['offset'][2])); MVq = anc2_ + (MVq - anc2_) * T2['scale']      # smaller about the front of the upper teeth: at full size the lower gums came out through the chin
    if T2['drop_lower_soft']:      # lower gums and tongue sit below the biting edge and showed through the chin; the lower teeth stay
        MFq0 = [list(dict.fromkeys(q_)) for q_ in MQ['mouth_F'].tolist()]; MQ = dict(MQ); MQ['mouth_F'] = np.array([q_ + [q_[-1]] * (4 - len(q_)) for q_ in MFq0 if all(iT_[v_] for v_ in q_) or MVq[q_, 2].mean() > anc2_[2] + 0.001], np.int32)
    MFq = [list(dict.fromkeys(q_)) for q_ in MQ['mouth_F'].tolist()]; isTq = MQ['mouth_isT']
    tq = mk_raw('teeth_ict', MVq.tolist(), MFq, None, bone='head')
    for p in tq.data.polygons: p.use_smooth = True; p.material_index = 0 if all(isTq[v_] for v_ in p.vertices) else 1
    # darker toward the back of the mouth and at the tops of the upper teeth, where little light reaches
    yf_ = float(MVq[isTq, 1].min()); zt_ = MVq[isTq, 2]; up_q = zt_ > np.median(zt_); ztop_ = float(zt_[up_q].max()); zbot_ = float(zt_[up_q].min())
    shade_ = np.clip((MVq[:, 1] - yf_) / T2['back_depth'], 0, 1) * T2['back_dark']; shade_ += T2['top_dark'] * np.clip((MVq[:, 2] - (ztop_ + zbot_) / 2) / max(ztop_ - (ztop_ + zbot_) / 2, 1e-4), 0, 1) * isTq
    vcq = tq.data.color_attributes.new('shade', 'FLOAT_COLOR', 'POINT'); cq_ = np.ones((len(MVq), 4)); cq_[:, :3] = (1 - np.clip(shade_, 0, 0.9))[:, None]; vcq.data.foreach_set('color', cq_.ravel())
    def mouth_mat_(name, col_, rough_, sss_):
        m_ = bpy.data.materials.new(name); m_.use_nodes = True; nt_ = m_.node_tree; b_ = nt_.nodes['Principled BSDF']; b_.inputs['Roughness'].default_value = rough_
        if sss_: b_.inputs['Subsurface Weight'].default_value = sss_; b_.inputs['Subsurface Radius'].default_value = (1.0, 0.6, 0.4); b_.inputs['Subsurface Scale'].default_value = 0.0008
        at_ = nt_.nodes.new('ShaderNodeVertexColor'); at_.layer_name = 'shade'; mx_ = nt_.nodes.new('ShaderNodeMix'); mx_.data_type = 'RGBA'; mx_.blend_type = 'MULTIPLY'; mx_.inputs['Factor'].default_value = 1.0
        mx_.inputs['A'].default_value = (*col_, 1); nt_.links.new(at_.outputs['Color'], mx_.inputs['B']); nt_.links.new(mx_.outputs['Result'], b_.inputs['Base Color']); return m_
    tq.data.materials.append(mouth_mat_('enamel', T2['enamel'], T2['enamel_rough'], T2['enamel_sss'])); tq.data.materials.append(mouth_mat_('gum', T2['gum'], T2['gum_rough'], 0.6))
    FACE.append((tq, [-1] * len(MVq)))
    for n_ in ('teeth_up', 'gum_up', 'teeth'):
        if n_ in bpy.data.objects: bpy.data.objects[n_].hide_render = True
    print('TEETH2: %d vertices, scale %.2f' % (len(MVq), float(MQ['mouth_scale'])))
GUM = 'gum' in sys.argv      # study: a gum band above the upper teeth, so a lifted lip shows gum and not a dark gap
if GUM:
    jm_ = [j_ for j_ in range(50) if arc_[j_] <= s0_ + 0.002]; gx_ = [-xs_[j_] for j_ in jm_[:0:-1]] + [xs_[j_] for j_ in jm_]; gy_ = [fy_[j_] for j_ in jm_[:0:-1]] + [fy_[j_] for j_ in jm_]
    ztg_ = float(zt_[0]); GV = []; GF = []
    for x_, y_ in zip(gx_, gy_):
        for dz_, dy_ in ((-0.0012, 0.0004), (0.0035, -0.0005), (0.0090, 0.0012)): GV.append((x_, y_ + dy_, ztg_ + dz_))
    for j_ in range(len(gx_) - 1):
        for r_ in range(2): a0 = j_ * 3 + r_; GF.append([a0, a0 + 3, a0 + 4, a0 + 1])
    gum = mk_raw('gum_up', GV, GF, None, bone='head'); gum.data.materials.append(mat('gum', color=C['gum_color'], rough=0.30))
teeth.data.materials.clear(); teeth.data.materials.append(mat('teeth_back', color=C['teeth_back'], rough=0.35))
par_ = list(range(len(teeth.data.vertices)))
def fnd_(a):
    while par_[a] != a: par_[a] = par_[par_[a]]; a = par_[a]
    return a
for e_ in teeth.data.edges: par_[fnd_(e_.vertices[0])] = fnd_(e_.vertices[1])
comp_ = {}
for k_ in range(len(par_)): comp_.setdefault(fnd_(k_), []).append(k_)
tc_ = np.array([v_.co[:] for v_ in teeth.data.vertices]); acy_ = tc_[:, 1].max()
print('TEETH islands', len(comp_))
for ks_ in comp_.values():
    c_ = tc_[ks_].mean(0); tg_ = np.array([-(c_[1] - acy_ - 0.02), c_[0], 0.0]); tg_ /= max(np.linalg.norm(tg_), 1e-6)   # along the arch
    if np.ptp(tc_[ks_] @ tg_) > 0.014: continue
    for k_ in ks_:
        v_ = teeth.data.vertices[k_]; d_ = float((tc_[k_] - c_) @ tg_); v_.co = Vector(tc_[k_] - tg_ * d_ * (1 - C['teeth_gap']))

# ----------------------------------------------------------------- outfit
def emb_tile(S=512):
    im = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(im)
    for cx, cy, R, a0 in ((128, 128, 96, 0), (384, 384, 96, 180), (384, 128, 60, 90), (128, 384, 60, 270)):
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                pts = []
                for s in range(140):
                    tt = s / 139; rad = R * (1 - 0.82 * tt); a = math.radians(a0) + tt * 4.2 * math.pi
                    pts.append((cx + ox + rad * math.cos(a), cy + oy + rad * math.sin(a)))
                dr.line(pts, fill=255, width=4)
                dr.ellipse((cx + ox - R - 6, cy + oy - R - 6, cx + ox + R + 6, cy + oy + R + 6), outline=200, width=2)
    h = np.asarray(im.filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 255
    return h
eh = emb_tile()
Image.fromarray(normal_from_height(eh, 5.0)).save(OUT + 'tex/emb_normal.png')
o = np.zeros((512, 512, 3), np.uint8); o[..., 0] = 255
o[..., 1] = ((C['cloth_rough'] * (1 - eh) + C['thread_rough'] * eh) * 255).astype(np.uint8)
Image.fromarray(o).save(OUT + 'tex/emb_orm.png')
def hexl(h): return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5))
OF = {k_: hexl(v_) for k_, v_ in C['outfit'].items()}
coat_m = mat('coat', color=OF['jacket'], cloth='twill', orm=OUT + 'tex/emb_orm.png', nrm=OUT + 'tex/emb_normal.png', nstr=C['emb_strength'], spec=C['cloth_spec'])
pants_m = mat('pants', color=OF['trousers'], rough=C['cloth_rough'], spec=C['cloth_spec'], cloth='twill')
linen_m = mat('linen', color=OF['linen'], rough=0.9, spec=C['cloth_spec'], cloth='weave'); trim_m = mat('trim', color=OF['trim'], rough=0.9, spec=C['cloth_spec'], cloth='weave'); leather_m = mat('leather', color=OF['leather'], rough=0.6, cloth='hide')
pewter_m = mat('pewter', color=OF['pewter'], rough=0.45, metal=0.85); solar_m = mat('solar', color=OF['solar'], rough=0.28, metal=0.6)
boot_m = mat('boot', color=OF['boots'], rough=0.55, cloth='hide')
metal_m = mat('metal', color=C['metal'], rough=0.18, metal=1.0)
hipz = jp(rig['pelvis']['head']).z
ARMB_ = lambda b: b.startswith(('upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky'))
shx_ = abs(jp(rig['upperarm_l']['head']).x); kneez_ = jp(rig['calf_l']['head']).z; bsc_ = C.get('body_scale', 1.0)
def keep_face(f):
    c = B[[v for v, _ in f]].mean(0); arm = np.mean([wsum(v, ARMB_) for v, _ in f]) > 0.5
    if arm and C.get('sleeves', 'long') != 'long' and abs(c[0]) > shx_ + (0.11 if C['sleeves'] == 'short' else 0.012) * bsc_: return False
    if not arm and C.get('legs', 'long') == 'shorts' and C['boot_top'] < c[2] < kneez_ + 0.06 * bsc_: return False
    return True
suit, sidx = mk('suit', G['helper-tights'], offset=C['suit_offset'])      # nothing is cut away (there is no body under the suit): bare arms and legs are suit faces in the skin colour
for lp in suit.data.loops:
    co = suit.data.vertices[lp.vertex_index].co; suit.data.uv_layers[0].data[lp.index].uv = (co.x * C['emb_scale'], co.z * C['emb_scale'])
for m in (coat_m, pants_m, boot_m, pewter_m, mat('sleeve', color=OF.get(C.get('sleeve_col') or 'jacket', OF['jacket']), rough=0.9, spec=C['cloth_spec'], cloth='twill'), mat('bare', color=tuple((c_ / 255) ** 2.2 for c_ in C['skin']), rough=C['skin_rough'])): suit.data.materials.append(m)
sh0_ = np.array(jp(rig['upperarm_l']['head'])); el0_ = np.array(jp(rig['lowerarm_l']['head'])); alen_ = float(np.linalg.norm(el0_ - sh0_)); adir_ = (el0_ - sh0_) / alen_
if sh0_[0] < 0: sh0_ = sh0_ * (-1, 1, 1); adir_ = adir_ * (-1, 1, 1)
LOWB_ = lambda b: b.startswith(('lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky'))
sxm_ = max(abs(p.center.x) for p in suit.data.polygons)
for p in suit.data.polygons:
    z = p.center.z
    p.material_index = 2 if z < C['boot_top'] else (0 if z > hipz + 0.03 or (abs(p.center.x) > 0.20 and z > hipz - 0.22) else 1)      # sage jacket and sleeves, moss trousers
    aw_ = np.mean([wsum(sidx[v_], ARMB_) for v_ in p.vertices]); lw_ = np.mean([wsum(sidx[v_], LOWB_) for v_ in p.vertices])
    sgx_ = 1 if p.center.x > 0 else -1; al_ = float((np.array(p.center) - sh0_ * (sgx_, 1, 1)) @ (adir_ * (sgx_, 1, 1))) if aw_ > 0.25 else -1      # distance along the arm from the shoulder joint: a straight seam
    if C.get('sleeve_col') and al_ > 0.005: p.material_index = 4      # shirt sleeves under a vest
    if (C.get('sleeves', 'long') == 'none' and al_ > 0.005) or (C.get('sleeves', 'long') == 'short' and al_ > 0.6 * alen_): p.material_index = 5      # bare arms
    if aw_ < 0.5 and C.get('legs', 'long') == 'shorts' and C['boot_top'] < z < kneez_ + 0.06 * bsc_: p.material_index = 5      # bare legs under shorts
    if C.get('silver_trim', True) and abs(p.center.x) > sxm_ - C['cuff_len'] and z > C['boot_top'] and p.material_index != 5: p.material_index = 3      # silver cuffs
# collar
tz = B[GI['helper-tights'], 2].max()
def ring(z):
    idx = [i for i in body_idx if abs(B[i][2] - z) < 0.012 and abs(B[i][0]) < 0.09 and dom(i) != 'head']
    P = B[idx]; c = (P[:, :2].max(0) + P[:, :2].min(0)) / 2; rad = (P[:, :2].max(0) - P[:, :2].min(0)) / 2
    return c, rad
cv = []; cf = []; cu = []; SEG = 28; gap = math.radians(20)
rows = [(tz - 0.050, 0.011, 0), (tz - 0.020, 0.013, 0.2), (tz + 0.018, 0.020, 0.5), (tz + 0.046, 0.027, 1)]
if C.get('collar', 'linen') == 'scarf': gap = 0.0; rows = [(tz - 0.050, 0.020, 0), (tz - 0.022, 0.030, 1.2), (tz + 0.004, 0.026, 0.6), (tz + 0.020, 0.016, 0.2)]      # a soft neck scarf, lower and fuller than the collar
for ri, (z, off, fl) in enumerate(rows):
    c, rad = ring(z)
    for s in range(SEG + 1):
        a = gap + (2 * math.pi - 2 * gap) * s / SEG            # 0 = front (-Y)
        fr_ = max(0, math.cos(a))                               # 1 at front
        cv.append((c[0] + (rad[0] + off) * math.sin(a), c[1] - (rad[1] + off) * math.cos(a), z - 0.018 * fl * fr_))
        cu.append((s / SEG * 3, ri / (len(rows) - 1) * 0.25))
for ri in range(len(rows) - 1):
    for s in range(SEG):
        a = ri * (SEG + 1) + s; cf.append([a, a + 1, a + SEG + 2, a + SEG + 1])
if C.get('collar', 'linen'):
    collar = mk_raw('collar', cv, cf, cu, bone='neck_01'); collar.data.materials.append(linen_m if C.get('collar', 'linen') == 'linen' else trim_m)
# coat hem: a skirt of cloth from the waist to mid-thigh, open at the front, so the bodysuit reads as a coat
ztop_, zbot_, off0_, off1_ = C['coat_hem'] or (0.06, -0.06, 0.012, 0.016); SV_ = np.array([B[i] for i in GI['helper-tights'] if wsum(i, ARMB_) < 0.5]); hv = []; hf = []; hu = []; HSEG = 20; HROW = 4
for ri in range(HROW + 1):
    t_ = ri / HROW; z = hipz + ztop_ + (zbot_ - ztop_) * t_; P = SV_[np.abs(SV_[:, 2] - z) < 0.03]
    if len(P) < 4: P = SV_[np.abs(SV_[:, 2] - (hipz - 0.05)) < 0.04]
    c = (P[:, :2].max(0) + P[:, :2].min(0)) / 2; rad = (P[:, :2].max(0) - P[:, :2].min(0)) / 2 + off0_ + (off1_ - off0_) * t_
    for sg_ in range(HSEG + 1):
        a = math.radians(9) + (2 * math.pi - math.radians(18)) * sg_ / HSEG
        hv.append((c[0] + rad[0] * math.sin(a), c[1] - rad[1] * math.cos(a), z)); hu.append((sg_ / HSEG * 4, t_))
for ri in range(HROW):
    for sg_ in range(HSEG):
        a = ri * (HSEG + 1) + sg_; hf.append([a, a + 1, a + HSEG + 2, a + HSEG + 1])
if C['coat_hem']:
    coat = mk_raw('coat', hv, hf, hu, bone='pelvis'); coat.data.materials.append(coat_m); coat.data.materials.append(pewter_m)
    for p in (coat.data.polygons[(HROW - 1) * HSEG:] if C.get('silver_trim', True) else []): p.material_index = 1      # silver band along the hem
# ---- outfit A extras: belt, wrap edge with clasp, chest strap, solar patch (all laid on the torso surface)
bz0_, bz1_, boff_ = C['belt']; bz0_ *= bsc_; bz1_ *= bsc_; bv = []; bf = []
for ri, zz in enumerate((hipz + bz0_, hipz + bz1_)):
    P = SV_[np.abs(SV_[:, 2] - zz) < 0.03]; c = (P[:, :2].max(0) + P[:, :2].min(0)) / 2; rad = (P[:, :2].max(0) - P[:, :2].min(0)) / 2 + boff_
    for sg_ in range(HSEG + 1):
        a = 2 * math.pi * sg_ / HSEG; bv.append((c[0] + rad[0] * math.sin(a), c[1] - rad[1] * math.cos(a), zz))
for sg_ in range(HSEG): bf.append([sg_, sg_ + 1, sg_ + HSEG + 2, sg_ + HSEG + 1])
if C.get('belt_on', True): belt = mk_raw('belt', bv, bf, None, bone='pelvis'); belt.data.materials.append(leather_m)
TOR_ = SV_[(SV_[:, 2] > hipz - 0.02) & (np.abs(SV_[:, 0]) < 0.19)]; tyc_ = float(TOR_[:, 1].mean())
def torso_y(x, z, front):
    Q = TOR_[(TOR_[:, 1] < tyc_) if front else (TOR_[:, 1] > tyc_)]; d_ = (Q[:, 0] - x) ** 2 + (Q[:, 2] - z) ** 2; o_ = np.argsort(d_)[:4]; w_ = 1 / (d_[o_] + 1e-6)
    y_ = float((Q[o_, 1] * w_).sum() / w_.sum()); e_ = Q[o_, 1].min() if front else Q[o_, 1].max()
    return (min(y_, e_ + 0.004) - C['suit_offset'] - C['cloth_margin']) if front else (max(y_, e_ - 0.004) + C['suit_offset'] + C['cloth_margin'])
def strip(name, a, b, width, front, m_, n_=10, bone='spine_03', lift=0.0):
    v = []; f = []; dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz); px, pz = -dz / L * width / 2, dx / L * width / 2
    for k_ in range(n_ + 1):
        t = k_ / n_; x, z = a[0] + dx * t, a[1] + dz * t
        for sd in (-1, 1):
            qx, qz = x + px * sd, z + pz * sd; v.append((qx, torso_y(qx, qz, front) + (-lift if front else lift), qz))
    for k_ in range(n_):
        q = [k_ * 2, k_ * 2 + 1, k_ * 2 + 3, k_ * 2 + 2]; n = np.cross(np.array(v[q[1]]) - np.array(v[q[0]]), np.array(v[q[3]]) - np.array(v[q[0]]))
        f.append(q if (n[1] < 0) == front else q[::-1])
    ob = mk_raw(name, v, f, None, bone=bone); ob.data.materials.append(m_); return ob
zsh_ = jp(rig['clavicle_l']['head']).z
KIT_ = C.get('scout_kit', True)
if KIT_ is True:
    strip('wrap', (-0.030, zsh_ - 0.035), (0.085, hipz + 0.115), C['wrap_w'], True, pewter_m)
    strip('clasp', (0.066, hipz + 0.150), (0.090, hipz + 0.118), 0.026, True, pewter_m, n_=2, lift=0.004)
if KIT_:
    strip('strap', (0.105 * bsc_, zsh_ - 0.012), (-0.125 * bsc_, hipz + 0.105 * bsc_), C['strap_w'], True, leather_m, lift=0.003)
    strip('strap_b', (0.105 * bsc_, zsh_ - 0.012), (-0.125 * bsc_, hipz + 0.105 * bsc_), C['strap_w'], False, leather_m, lift=0.003)
if C.get('belt_on', True): strip('buckle', (-0.022, hipz + (bz0_ + bz1_) / 2), (0.022, hipz + (bz0_ + bz1_) / 2), (bz0_ - bz1_) * 1.25, True, pewter_m, n_=2, bone='pelvis', lift=0.012)
if KIT_ is True: strip('patch', (-0.105, zsh_ - 0.045), (-0.105, zsh_ - 0.095), 0.042, True, solar_m, n_=3, lift=0.003)
# earrings
def torus(c, a, b, tr, n=20, mseg=6):
    vs = []; fs = []
    for i in range(n):
        A = 2 * math.pi * i / n; p = Vector((c[0] + a * math.cos(A), c[1], c[2] + b * math.sin(A)))
        nrm = Vector((b * math.cos(A), 0, a * math.sin(A))).normalized()
        for j in range(mseg):
            Bn = 2 * math.pi * j / mseg
            vs.append(tuple(p + nrm * tr * math.cos(Bn) + Vector((0, 1, 0)) * tr * math.sin(Bn)))
    for i in range(n):
        for j in range(mseg):
            fs.append([i * mseg + j, ((i + 1) % n) * mseg + j, ((i + 1) % n) * mseg + (j + 1) % mseg, i * mseg + (j + 1) % mseg])
    return vs, fs
for sgn in ((1, -1) if C.get('earrings', True) else ()):
    earv = HP[(HP[:, 0] * sgn > 0.86 * earx)]
    lobe = earv[earv[:, 2].argmin()]
    vs, fs = torus((lobe[0], lobe[1], lobe[2] - 0.030), 0.0085, 0.022, 0.0015)
    v2, f2 = torus((lobe[0], lobe[1] - 0.001, lobe[2] + 0.001), 0.003, 0.003, 0.0018, n=8, mseg=5)
    fs += [[k + len(vs) for k in f] for f in f2]; vs += v2
    er = mk_raw('earring_' + ('l' if sgn > 0 else 'r'), vs, fs); er.data.materials.append(metal_m)
    print('EAR lobe', np.round(lobe, 3))

# ----------------------------------------------------------------- hair (strand cards along guide paths)
def hair_tex(S=512):
    r = np.random.default_rng(C['seed'] + 21)
    im = np.zeros((S, S, 4), np.float32); Wn = S // 5
    L, M, Dk = [np.array(C[n], np.float32) for n in ('hair_light', 'hair_mid', 'hair_dark')]
    vv = np.linspace(1, 0, S)                                    # row 0 = root (v=1)
    for j in range(5):
        x = 2
        while x < Wn - 2:
            w = int(r.integers(1, C['hair_strand_px'] + 1)); xc = (x + w / 2) / Wn; edge = abs(xc - .5) * 2
            dense = (1.0 - 0.3 * edge) if j == 0 else (1.0 - C['hair_edge_thin'] * edge ** 1.5)
            if r.random() < dense:
                val = np.clip(0.55 + 0.25 * r.standard_normal(), 0, 1)
                c_ = Dk + (M - Dk) * val * 2 if val < .5 else M + (L - M) * (val - .5) * 2
                if j == 4: c_ = np.array(C['hair_red'][1], np.float32) + (np.array(C['hair_red'][0], np.float32) - np.array(C['hair_red'][1], np.float32)) * val
                end = r.random() * C['hair_tip_len'] * (0.5 + edge) * (0.6 if j == 0 else 1.0)
                grad = (0.86 + 0.14 * np.clip((1 - vv) / 0.25, 0, 1))[:, None]
                im[:, j * Wn + x:j * Wn + x + w, :3] = c_[None, None] * grad[:, None]
                im[:, j * Wn + x:j * Wn + x + w, 3] = (vv > end)[:, None] * 255
            x += w
    p = OUT + 'tex/hair.png'; Image.fromarray(im.astype(np.uint8), 'RGBA').save(p); return p
Hc = np.array([0.0, HP[:, 1].mean(), ez + 0.035])
sv_ = HP[np.abs(HP[:, 0]) < 0.9 * earx]; dv_ = sv_ - Hc; rv_ = np.linalg.norm(dv_, axis=1); ud_ = dv_ / rv_[:, None]
def scalpR(d): return rv_[np.argsort(-(ud_ @ d))[:4]].max()
def smoothR(ds):                                               # scalp radius along a path of directions, smoothed (the raw one steps)
    r = np.array([scalpR(d) for d in ds])
    for _ in range(4):
        q_ = r.copy(); q_[1:-1] = (r[:-2] + 2 * r[1:-1] + r[2:]) / 4; r = np.maximum(q_, r - 0.0015)
    return r
ARMB = lambda b: b.startswith(('upperarm', 'lowerarm')) or HANDB(b)
tv_ = [B[i] for i in GI['helper-tights'] if wsum(i, ARMB) < 0.5] + [B[i] for i in body_idx if dom(i) == 'neck_01'] + [np.array(p) for p in cv]
tv_ += [np.array(p) for p in HP if abs(p[0]) < 0.9 * earx]
tv_ = np.array(tv_); ya = float(np.mean([p[1] for p in cv]))
ZB, AB = 0.015, 36; z0g = 0.9; nzb = int((ztop - z0g) / ZB) + 2
grid = np.zeros((nzb, AB))
for p in tv_:
    if p[2] < z0g: continue
    zi = int((p[2] - z0g) / ZB); ai = int((math.atan2(p[0], -(p[1] - ya)) + math.pi) / (2 * math.pi) * AB) % AB
    grid[zi, ai] = max(grid[zi, ai], math.hypot(p[0], p[1] - ya))
for it in range(3):
    g2 = grid.copy()
    for da in (-1, 1): g2 = np.maximum(g2, np.roll(grid, da, 1) * 0.97)
    g2[1:] = np.maximum(g2[1:], grid[:-1] * 0.97); g2[:-1] = np.maximum(g2[:-1], grid[1:] * 0.97); grid = g2
def surfR(z, beta):
    zi = min(max(int((z - z0g) / ZB), 0), nzb - 1); ai = int((beta + math.pi) / (2 * math.pi) * AB) % AB
    return grid[zi, ai]
def sdir(theta, alpha, s): return np.array([s * math.sin(theta) * math.sin(alpha), -math.sin(theta) * math.cos(alpha), math.cos(theta)])
def slerp(a, b, t):
    om = math.acos(max(-1, min(1, float(a @ b))))
    return a if om < 1e-5 else (math.sin((1 - t) * om) * a + math.sin(t * om) * b) / math.sin(om)
hrng = np.random.default_rng(C['seed'] + 5)
HV = []; HF = []; HUV = []; HW = []
zsh = jp(rig['clavicle_l']['head']).z
LOCKS = []
def lock(s, gamma, alpha_e, theta_e, beta_t, z_end, width, win, lift, pts_override=None):
    if pts_override is None and C.get('lock_end') is not None: z_end = zchin + C['lock_end'] + 0.03 * hrng.random()      # bob: locks end near the chin
    d0 = np.array([s * 0.05, math.sin(gamma), math.cos(gamma)]); d0 /= np.linalg.norm(d0)
    d1 = sdir(theta_e, alpha_e, s); pts = []
    NA, NB = 8, 14
    ds = [slerp(d0, d1, k / NA) for k in range(NA + 1)]; ds = [d / np.linalg.norm(d) for d in ds]; rr = smoothR(ds)
    for k in range(NA + 1):
        t = k / NA; pts.append(Hc + ds[k] * (rr[k] + 0.002 + lift * (0.25 + 0.75 * t)))
    p1 = pts[-1]; b1 = math.atan2(p1[0], -(p1[1] - ya)); r1 = math.hypot(p1[0], p1[1] - ya); z1 = p1[2]
    cl = C['hair_clear'] + lift; rt = surfR(z_end, beta_t) + cl
    for k in range(1, NB + 1):
        t = k / NB; z = z1 - (z1 - z_end) * t; e = min(1, t * 1.5); e = e * e * (3 - 2 * e)
        be = b1 + (beta_t - b1) * e
        r = max(r1 + (rt - r1) * t, surfR(z, be) + cl)
        pts.append(np.array([r * math.sin(be), ya - r * math.cos(be), z]))
    pts = np.array(pts) if pts_override is None else pts_override; n = len(pts); ph, ph2 = hrng.random(2) * 6.28
    for _ in range(7):                                           # smooth the fall (the clearance grid is coarse and left steps)
        q_ = pts.copy(); q_[NA + 1:n - 1] = (pts[NA:n - 2] + 2 * pts[NA + 1:n - 1] + pts[NA + 2:n]) / 4; pts = q_
    sides = []; outs = []
    for k in range(n):
        tan = pts[min(k + 1, n - 1)] - pts[max(k - 1, 0)]; tan /= np.linalg.norm(tan)
        cz = min(pts[k][2], Hc[2]); f_ = min(1, max(0, (Hc[2] - cz) / 0.15)); cpt = np.array([0, Hc[1] + (ya - Hc[1]) * f_, cz])
        out = pts[k] - cpt; out /= np.linalg.norm(out)
        side = np.cross(tan, out); side /= np.linalg.norm(side); out = np.cross(side, tan)
        sides.append(side); outs.append(out)
    LOCKS.append(dict(p=np.round(pts, 4).tolist(), s=np.round(sides, 3).tolist(), o=np.round(outs, 3).tolist(), w=round(float(width), 4), win=int(win), ph=[round(float(ph), 3), round(float(ph2), 3)]))
    base = len(HV); u0 = win / 5 + 0.004; u1 = (win + 1) / 5 - 0.004
    A = C['hair_wave']; F = C['hair_wave_freq'] * 2 * math.pi
    for k in range(n):
        t = k / (n - 1)
        c = pts[k] + sides[k] * A * math.sin(F * t + ph2) * t + outs[k] * 0.6 * A * math.sin(F * 1.3 * t + ph) * t
        w = width * C['hair_width_scale'] * (C['hair_root_w'] + (1 - C['hair_root_w']) * math.sin(math.pi / 2 * min(t * 2.2, 1))) * (1 - 0.7 * max(0, (t - 0.7) / 0.3))
        wh = min(1, max(0, (pts[k][2] - zsh) / max(zchin - zsh, 1e-3)))
        for j, (a_, o_) in enumerate(((-0.5, 0), (0, C['hair_curve']), (0.5, 0))):
            HV.append(tuple(c + sides[k] * w * a_ + outs[k] * w * o_)); HUV.append((u0 + (u1 - u0) * j / 2, 1 - t)); HW.append(wh)
    for k in range(n - 1):
        for j in range(2):
            a_ = base + k * 3 + j; HF.append([a_, a_ + 1, a_ + 4, a_ + 3])
R_ = math.radians
for s in (1, -1):
    for i in range(C['hair_base_n']):                              # dense under layer, back half
        f = (i + .5) / C['hair_base_n']
        lock(s, R_(-10 + 55 * f), R_(118 + 60 * f), R_(108), s * R_(112 + 64 * f), 1.08 + 0.04 * hrng.random(), 0.050, 0, 0.001 + 0.002 * hrng.random())
    for i in range(C['hair_mid_n']):                               # over the top, behind the ear, down the back
        f = (i + hrng.random() * .6) / C['hair_mid_n']
        lock(s, R_(-42 + 82 * f), R_(116 + 62 * f), R_(104 + 8 * hrng.random()), s * R_(105 + 72 * f), 1.06 + 0.10 * hrng.random(), 0.030 + 0.010 * hrng.random(), 1 + int(hrng.integers(0, 3)), (C['hair_loose_lift'] * (0.8 + 0.4 * hrng.random())) if i % 3 == 1 else 0.002 + 0.002 * hrng.random())
    for i in range(C['hair_front_n']):                             # face-framing, in front of the ear, onto the chest
        f = (i + .5) / C['hair_front_n']
        lock(s, R_(-50 + 14 * f), R_(C['hair_front_alpha'] + 12 * f), R_(100), s * R_(34 + 22 * f), 1.20 + 0.08 * hrng.random(), 0.020 + 0.006 * hrng.random(), 1 + int(hrng.integers(0, 3)), 0.003 + 0.006 * hrng.random())
def fringe(s, alpha, z_end, width, win, lift):               # curtain bangs: from the parting down and out over the forehead, ends hang down
    d0 = np.array([s * 0.05, math.sin(R_(-50)), math.cos(R_(-50))]); d0 /= np.linalg.norm(d0)
    rho = 0.085; d1 = np.array([s * math.sin(alpha) * rho, -math.cos(alpha) * rho, z_end - Hc[2]]); d1 /= np.linalg.norm(d1)
    n = 23; pts = []
    for k in range(n):
        t = k / (n - 1); d = slerp(d0, d1, t); d /= np.linalg.norm(d)
        pts.append(Hc + d * (scalpR(d) + 0.003 + lift * t))
    pts = np.array(pts)
    for _ in range(4):
        q_ = pts.copy(); q_[1:n - 1] = (pts[:n - 2] + 2 * pts[1:n - 1] + pts[2:]) / 4; pts = q_
    lock(s, 0, 0, 0, 0, 0, width, win, 0, pts_override=pts)
for s in (1, -1):
    for i in range(C['hair_fringe_n']):
        f = (i + .5) / C['hair_fringe_n']
        fringe(s, R_(C['fringe_a0'] + (C['fringe_a1'] - C['fringe_a0']) * f + 4 * hrng.random()), ez + C['fringe_z0'] + (C['fringe_z1'] - C['fringe_z0']) * f ** 1.5 + 0.010 * hrng.random(), C['fringe_w'] * (0.8 + 0.5 * hrng.random()), 1 + int(hrng.integers(0, 3)), C['fringe_lift'] * (0.6 + 0.8 * hrng.random()))
def tuft(s, gamma, alpha_e, theta_e, length, width, win, lift):      # short loose piece: follows the scalp, then flicks out and down
    d0 = np.array([s * 0.04, math.sin(gamma), math.cos(gamma)]); d0 /= np.linalg.norm(d0); d1 = sdir(theta_e, alpha_e, s)
    ds = [slerp(d0, d1, k / 8) for k in range(9)]; ds = [d / np.linalg.norm(d) for d in ds]; rr = smoothR(ds)
    pts = [Hc + ds[k] * (rr[k] + 0.004 + lift * (0.3 + 0.7 * k / 8)) for k in range(9)]
    tg = pts[8] - pts[7]; tg /= np.linalg.norm(tg); out = ds[8]
    for k in range(1, 5): pts.append(pts[8] + (tg * 0.8 + out * 0.35 + np.array([0, 0, -0.5])) * length * k / 4)
    lock(s, 0, 0, 0, 0, 0, width, win, 0, pts_override=np.array(pts))
for s in (1, -1):
    for i in range(C.get('tufts', 0)):
        tuft(s, R_(-50 + 105 * hrng.random()), R_(15 + 160 * hrng.random()), R_(50 + 55 * hrng.random()), 0.012 + 0.02 * hrng.random(), 0.022 + 0.012 * hrng.random(), 1 + int(hrng.integers(0, 3)), 0.003 + 0.012 * hrng.random())
if C.get('bun'):                                                   # hair bun at the back of the head
    bc_ = Hc + np.array([0, 1, 0.25]) / np.linalg.norm([0, 1, 0.25]) * (scalpR(np.array([0, 0.97, 0.243])) + 0.035); b0_ = len(HV); NU_, NV_ = 10, 6
    for iv in range(NV_ + 1):
        for iu in range(NU_ + 1):
            th_, ph_ = math.pi * iv / NV_, 2 * math.pi * iu / NU_; p = bc_ + 0.05 * np.array([math.sin(th_) * math.cos(ph_), 0.85 * math.cos(th_), math.sin(th_) * math.sin(ph_)])
            HV.append(tuple(p)); HUV.append((0.004 + 0.192 * (iu % 2), 0.55 + 0.4 * iv / NV_)); HW.append(1.0)
    for iv in range(NV_):
        for iu in range(NU_):
            a_ = b0_ + iv * (NU_ + 1) + iu; HF.append([a_, a_ + 1, a_ + NU_ + 2, a_ + NU_ + 1])
# hair shell: one closed sheet from the parting over the crown, behind the ear and down the back (real mesh under/over the strand cards)
SN = C['shell_n']
for s in (1, -1):
    P = []
    for i in range(SN + 1):
        f = i / SN
        d0 = np.array([0.0, math.sin(R_(-46 + 91 * f)), math.cos(R_(-46 + 91 * f))])                     # both sheets meet on the centre line: no gap at the parting
        d1 = sdir(R_(106), R_(104 + 76 * f), s); beta_t = s * R_(100 + 80 * f); pts = []
        NA, NB = 8, 14
        dm = d0 + np.array([s * 0.75, 0, 0]); dm /= np.linalg.norm(dm)
        ds = [slerp(slerp(d0, dm, k / NA), slerp(dm, d1, k / NA), k / NA) for k in range(NA + 1)]; ds = [d / np.linalg.norm(d) for d in ds]; rr = smoothR(ds); rr[0] -= C['part_crease']
        sl_ = C['shell_lift'] * min(1, 0.2 + f * 5)
        for k in range(NA + 1): pts.append(Hc + ds[k] * (rr[k] + 0.0015 + sl_))
        p1 = pts[-1]; b1 = math.atan2(p1[0], -(p1[1] - ya)); r1 = math.hypot(p1[0], p1[1] - ya); z1 = p1[2]
        cl = C['hair_clear']; z_end = (zchin + C['shell_end'][1]) if isinstance(C['shell_end'], tuple) else C['shell_end']; rt = surfR(z_end, beta_t) + cl
        for k in range(1, NB + 1):
            t = k / NB; z = z1 - (z1 - z_end) * t; e = min(1, t * 1.5); e = e * e * (3 - 2 * e)
            be = b1 + (beta_t - b1) * e; r = max(r1 + (rt - r1) * t, surfR(z, be) + (cl + sl_ * (1 - t)) * min(1, t * 3))
            pts.append(np.array([r * math.sin(be), ya - r * math.cos(be), z]))
        pts = np.array(pts); n = len(pts)
        for _ in range(7):
            q_ = pts.copy(); q_[NA + 1:n - 1] = (pts[NA:n - 2] + 2 * pts[NA + 1:n - 1] + pts[NA + 2:n]) / 4; pts = q_
        P.append(pts)
    P = np.array(P)
    for _ in range(1):
        q_ = P.copy(); q_[1:SN] = (P[:SN - 1] + 2 * P[1:SN] + P[2:]) / 4; P = q_
    n = P.shape[1]; base = len(HV)
    for i in range(SN + 1):
        for k in range(n):
            p = P[i][k]; HV.append(tuple(p)); HUV.append((0.004 if i % 2 == 0 else 0.196, 1 - k / (n - 1))); HW.append(min(1, max(0, (p[2] - zsh) / max(zchin - zsh, 1e-3))))
    for i in range(SN):
        for k in range(n - 1):
            a_ = base + i * n + k; b_ = a_ + n; HF.append([a_, b_, b_ + 1, a_ + 1] if s == 1 else [b_, a_, a_ + 1, b_ + 1])
for q_ in range(3 if C.get('pink_lock', True) else 0): lock(1, R_(-49 + 2 * q_), R_(80 + 3 * q_), R_(100), R_(40 + 4 * q_), 1.22 + 0.02 * q_, 0.019, 4, 0.017 + 0.002 * q_)      # Marla: a lock of pink-red hair, front left of the face
hair = mk_raw('hair', HV, HF, HUV, bone='head')
vg2 = hair.vertex_groups.new(name='spine_03'); vg1 = hair.vertex_groups['head']
for k, wh in enumerate(HW):
    vg1.add([k], max(wh, 0.001), 'REPLACE'); vg2.add([k], max(1 - wh, 0.001), 'REPLACE')
hair.data.materials.append(mat('hair', base=hair_tex(), rough=C['hair_rough'], alpha_clip=True))
print('HAIR locks', len(HF) // 38, 'tris', len(HF) * 2)

if C.get('hat'):                                                   # straw hat (crown + brim) or a soft cap, sitting on the hair
    hk_, hcol_ = C['hat']; hyc_ = (HP[:, 1].max() + HP[:, 1].min()) / 2; rx_ = 0.90 * earx + 0.026; ry_ = (HP[:, 1].max() - HP[:, 1].min()) / 2 + 0.024; z0_ = Hc[2] + 0.030; rz_ = ztop - z0_ + (0.030 if hk_ == 'straw' else 0.022)
    hv_ = []; hf_ = []; NS_, NR_ = 18, 5
    for ir in range(NR_ + 1):
        th_ = (math.pi / 2) * ir / NR_; fl_ = 0.80 if hk_ == 'straw' else 1.0
        for is_ in range(NS_):
            a_ = 2 * math.pi * is_ / NS_; rr_ = math.cos(th_) ** (0.45 if hk_ == 'straw' else 1.0)
            hv_.append((rx_ * rr_ * math.sin(a_), hyc_ - ry_ * rr_ * math.cos(a_), z0_ + rz_ * fl_ * math.sin(th_)))
    for ir in range(NR_):
        for is_ in range(NS_):
            a_ = ir * NS_ + is_; b_ = ir * NS_ + (is_ + 1) % NS_; hf_.append([a_, b_, b_ + NS_, a_ + NS_])
    if hk_ == 'straw':
        o_ = len(hv_)
        for is_ in range(NS_):
            a_ = 2 * math.pi * is_ / NS_; hv_.append(((rx_ + 0.085) * math.sin(a_), hyc_ - (ry_ + 0.085) * math.cos(a_), z0_ - 0.012))
        for is_ in range(NS_): hf_.append([o_ + is_, o_ + (is_ + 1) % NS_, (is_ + 1) % NS_, is_])
    else:
        o_ = len(hv_)
        for is_ in range(NS_):
            a_ = 2 * math.pi * is_ / NS_; fr_b = max(0, math.cos(a_)) ** 3; hv_.append(((rx_ + 0.07 * fr_b) * math.sin(a_), hyc_ - (ry_ + 0.07 * fr_b) * math.cos(a_), z0_ - 0.006 * fr_b))
        for is_ in range(NS_): hf_.append([o_ + is_, o_ + (is_ + 1) % NS_, (is_ + 1) % NS_, is_])      # a short peak at the front
    hat = mk_raw('hat', hv_, hf_, None, bone='head'); hat.data.materials.append(mat('hat', color=OF[hcol_], rough=0.85))

# ----------------------------------------------------------------- expressions (shape keys = glTF morph targets)
def gw(P, c, r): return np.exp(-((P[:, 0] - c[0]) ** 2 + (P[:, 2] - c[1]) ** 2) / (2 * r * r))
lipsel = (lipm > 0.5) & msk; mz = float(Z[lipsel].mean())
fid = np.array(sorted(set(i for ob, idx in FACE if not ob.name.startswith(('eye_', 'teeth')) for i in idx)))
Pf = B[fid]; fr_ = Pf[:, 1] < ey + 0.055
if 'dump' in sys.argv:      # face vertices, normals and landmarks for the expression transfer tool (ict_transfer.py)
    nrm_ = {}
    for ob_, idx_ in FACE:
        if ob_.name.startswith(('eye_', 'teeth')): continue
        for k_, v_ in enumerate(ob_.data.vertices): nrm_[int(idx_[k_])] = tuple(v_.normal)
    bo_, bi_ = FACE[0]; ed_ = np.array([(bi_[e_.vertices[0]], bi_[e_.vertices[1]]) for e_ in bo_.data.edges])
    np.savez(OUT + 'face_dump.npz', B=B, head_v=head_v, edges=ed_, fid=fid, P=Pf, N=np.array([nrm_.get(int(i), (0, -1, 0)) for i in fid]), eye=np.array([ex, ey, ez]), mz=mz, znS=znS)
    print('DUMPED', len(fid)); sys.exit(0)
CUSTOM = {}
def cu(name, d, m):
    CUSTOM[name] = {int(i): d[k] for k, i in enumerate(fid) if m[k] and np.abs(d[k]).max() > 2e-5}
for side, sg in (('left', 1), ('right', -1)):
    sm_ = fr_ & (Pf[:, 0] * sg > -0.004)
    cf, cz, cl = C['cheek_raise']
    d = np.outer(gw(Pf, (sg * (ex + 0.012), ez - 0.036), 0.020), (0, -cf, cz)) + np.outer(gw(Pf, (sg * ex, ez - 0.013), 0.011) * (Pf[:, 2] < ez - 0.004), (0, -0.001, cl))
    cu('cheek-%s-raise' % side, d, sm_)
    bi, bo = C['brow_slant']
    d = np.outer(gw(Pf, (sg * 0.013, ez + 0.024), 0.012), (-sg * 0.001, 0, bi)) + np.outer(gw(Pf, (sg * (ex + 0.022), ez + 0.024), 0.014), (0, 0, -bo))
    cu('eyebrows-%s-slant' % side, d, sm_)
mw_ = float(ax[lipsel].max())
for side, sg in (('left', 1), ('right', -1)):
    so_, sb_, su_ = C['smile_wide']
    cu('smile-%s-wide' % side, np.outer(gw(Pf, (sg * mw_, mz), 0.012), (sg * so_, sb_, su_)), fr_ & (Pf[:, 0] * sg > -0.004))
cu('upper-lip-raise', np.outer(sum(gw(Pf, (x_, mz + 0.007), 0.009) for x_ in (-0.013, 0, 0.013)) * (Pf[:, 2] > mz + 0.0005), (0, 0, C['lip_raise'])), fr_)
hf, hz_, hl_ = C['chin_crumple']
d = np.outer(gw(Pf, (0, zchin + 0.016), 0.019) * (np.abs(Pf[:, 0]) < 0.04), (0, -hf, hz_)) + np.outer(gw(Pf, (0, mz - 0.008), 0.009) * (np.abs(Pf[:, 0]) < 0.03), (0, -hf * .5, hl_))
cu('chin-crumple', d, fr_)
ICTU = {}
def unit(name):
    if name in CUSTOM: return CUSTOM[name]
    if name.startswith('ict-'):      # sculpted shapes moved over from the USC ICT-FaceKit head (MIT licence) by ict_transfer.py; 'ict-left-mouthSmile' -> mouthSmile_L
        if not ICTU: ICTU.update(np.load(next((f_ for f_ in ('/home/claude/marla/ict_units_%s.npz' % t_ for t_ in ('shape3', 'profile2') if t_ in sys.argv) if os.path.exists(f_)), '/home/claude/marla/ict_units.npz')))
        p_ = name.split('-'); key_ = p_[2] + {'left': '_L', 'right': '_R'}[p_[1]] if p_[1] in ('left', 'right') else p_[1]
        return {int(i): ICTU[key_][k] for k, i in enumerate(ICTU['fid']) if np.abs(ICTU[key_][k]).max() > 2e-5}
    dl = {}
    for l in gzip.open(D + 'targets/expression/units/caucasian/' + name + '.target.gz', 'rt'):
        t = l.split()
        if len(t) == 4 and not l.startswith('#'): dl[int(t[0])] = np.array([float(t[1]), -float(t[3]), float(t[2])]) * 0.1
    return dl
# ---- sculpted grin (user 2026-11-14: the grinning reference "is the end result I want"). Five hand-placed shapes on top of the stock units.
if 'units' not in sys.argv or True:
    uo_ = unit('mouth-open'); lowm = np.array([abs(uo_.get(int(i), (0, 0, 0))[2]) > 0.0015 for i in fid]); aP = np.abs(Pf[:, 0]); GS = C['grin_sculpt']; print('LOWER-LIP verts', int(lowm.sum()))
    xin = np.clip(1 - (aP / (mw_ + 0.006)) ** 4, 0, 1)
    # A: upper lip lifts and thins: the whole upper row of teeth shows
    upm = fr_ & ~lowm & (Pf[:, 2] > mz - 0.003) & (Pf[:, 2] < mz + 0.020) & (aP < mw_ + 0.008)
    va = np.clip(1 - (Pf[:, 2] - mz) / 0.020, 0.25, 1) * xin
    cu('grin-upper-lip', np.outer(va, (0, GS['lip_back'], GS['upper_lip'])), upm)
    # B: lower lip stretches into a shallow bowl: sides rise to the corners, centre stays under the teeth
    lom = fr_ & lowm & (Pf[:, 2] > mz - 0.016) & (aP < mw_ + 0.008)
    vb = np.clip(1 - (mz - Pf[:, 2]) / 0.016, 0, 1)
    cu('grin-lower-lip', np.outer(vb * (aP / mw_) ** 1.5, (0, GS['lip_back'], GS['lower_side'])) + np.outer(vb * xin * (aP < 0.008), (0, 0, GS['lower_mid'])), lom)
    for side, sg in (('left', 1), ('right', -1)):
        sm_ = fr_ & (Pf[:, 0] * sg > -0.002)
        # C: nose-to-mouth fold presses in while the cheek above it bulges up and out
        d = np.zeros_like(Pf)
        for k_ in range(7):
            t_ = k_ / 6; d += np.outer(gw(Pf, (sg * (0.018 + (mw_ + 0.007 - 0.018) * t_), znS - 0.004 + (mz + 0.004 - znS + 0.004) * t_), 0.0042), (-sg * 0.3 * GS['fold'], GS['fold'], 0)) / 3.5
        d += np.outer(gw(Pf, (sg * (ex + 0.008), znS + 0.004), 0.014), (sg * 0.4 * GS['apple'], -GS['apple'], 0.8 * GS['apple']))
        cu('grin-%s-fold' % side, d, sm_)
        # D: lower eyelid pushed up by the cheek: the eye becomes a crescent
        d = np.outer(gw(Pf, (sg * ex, ez - 0.009), 0.010) * (Pf[:, 2] < ez - 0.0015), (0, -0.0006, GS['lower_lid']))
        cu('grin-%s-lid' % side, d, sm_)
        # E: nostril wings flare and lift
        cu('grin-%s-nose' % side, np.outer(gw(Pf, (sg * 0.016, znS - 0.003), 0.006), (sg * GS['flare'], 0, 0.5 * GS['flare'])), sm_)
# ---- study shapes 2026-11-14 (from the Zarins smile page and fat-compartment chart; not approved)
if True:
    zA_, zB_ = znS - 0.004, mz + 0.004; xA_, xB_ = 0.017, mw_ + 0.007; Ld_ = math.hypot(xB_ - xA_, zB_ - zA_); SL = C['slide']; LL = C['lip_lift']
    # signed distance from the nose-to-mouth line, + toward the ear
    sd_ = -((aP - xA_) * (zB_ - zA_) - (Pf[:, 2] - zA_) * (xB_ - xA_)) / Ld_
    for side, sg in (('left', 1), ('right', -1)):
        sm_ = fr_ & (Pf[:, 0] * sg > 0.002)
        ramp_ = np.clip(sd_ / SL['edge'], 0, 1) ** 0.7; press_ = np.exp(-(sd_ / 0.0025) ** 2) * (Pf[:, 2] < zA_ + 0.004) * (Pf[:, 2] > zB_ - 0.010)
        mass_ = gw(Pf, (sg * (ex + 0.006), (znS + ez) / 2 - 0.004), SL['r'])
        d = np.outer(ramp_ * mass_, (sg * SL['out'], -SL['fwd'], SL['up'])) + np.outer(press_, (0, SL['press'], 0))
        d += np.outer(gw(Pf, (sg * (ex + 0.002), ez - 0.017), 0.009) * (Pf[:, 2] < ez - 0.006), (0, -SL['bag'], SL['bag'] * 0.5))
        cu('cheek-%s-slide' % side, d, sm_)
        cu('lid-%s-arc' % side, np.outer(gw(Pf, (sg * ex, ez - 0.0075), 0.007) * (Pf[:, 2] < ez - 0.001), (0, -0.0004, C['lid_arc'])), sm_)
    t_ = np.clip((Pf[:, 2] - mz) / (znS - mz), 0, 1); xin2_ = np.clip(1 - (aP / (mw_ + 0.004)) ** 2.5, 0, 1)      # even across the lip, easing to nothing at the corners
    cu('lip-lift', np.outer((1 - t_) ** 0.6 * xin2_, (0, LL['back'], LL['up'])), fr_ & ((Pf[:, 2] > mz + 0.001) | (~lowm & (Pf[:, 2] > mz - 0.003))) & (Pf[:, 2] < znS) & (aP < mw_ + 0.006))
UNITS = sorted(f[:-10] for f in os.listdir(D + 'targets/expression/units/caucasian') if f.endswith('.target.gz')) + sorted(CUSTOM)
if 'units' in sys.argv:                      # every unit as its own morph target, for the expression tool
    for un in UNITS:
        dl = unit(un)
        for ob, idx in FACE:
            if not any(i in dl for i in idx): continue
            if not ob.data.shape_keys: ob.shape_key_add(name='Basis')
            sk = ob.shape_key_add(name='u_' + un)
            for k_, i in enumerate(idx):
                if i in dl: sk.data[k_].co = ob.data.vertices[k_].co + Vector(dl[i])
            sk.value = 0.0
# face-shape sliders for the tool: (id, label, minus targets, plus targets, keep-skull mask)
LR = lambda p: [p.replace('*', 'l'), p.replace('*', 'r')]
SHAPES = [
    ('face_length', 'Face length', ['head/head-scale-vert-decr'], ['head/head-scale-vert-incr'], True),
    ('face_width', 'Face width', ['head/head-scale-horiz-decr'], ['head/head-scale-horiz-incr'], True),
    ('jaw_width', 'Jaw width', ['chin/chin-width-decr'], ['chin/chin-width-incr'], False),
    ('jaw_angle', 'Jaw corners', ['chin/chin-bones-decr'], ['chin/chin-bones-incr'], False),
    ('chin_height', 'Chin height', ['chin/chin-height-decr'], ['chin/chin-height-incr'], False),
    ('chin_forward', 'Chin forward', ['chin/chin-prominent-decr'], ['chin/chin-prominent-incr'], False),
    ('cheekbones', 'Cheekbones', LR('cheek/*-cheek-bones-decr'), LR('cheek/*-cheek-bones-incr'), False),
    ('cheek_full', 'Cheek fullness', LR('cheek/*-cheek-volume-decr'), LR('cheek/*-cheek-volume-incr'), False),
    ('cheek_inner', 'Cheek hollow', LR('cheek/*-cheek-inner-incr'), LR('cheek/*-cheek-inner-decr'), False),
    ('age', 'Younger / older', ['head/head-age-decr'], ['head/head-age-incr'], True),
    ('oval', 'Oval face', [], ['head/head-oval'], True),
    ('heart', 'Heart-shaped face', [], ['head/head-invertedtriangular'], True),
    ('forehead', 'Forehead height', ['forehead/forehead-scale-vert-decr'], ['forehead/forehead-scale-vert-incr'], True),
    ('eye_size', 'Eye size', LR('eyes/*-eye-scale-decr'), LR('eyes/*-eye-scale-incr'), False),
    ('eye_tilt', 'Eye tilt', LR('eyes/*-eye-corner2-down'), LR('eyes/*-eye-corner2-up'), False),
    ('eye_open', 'Eye opening', LR('eyes/*-eye-height2-decr'), LR('eyes/*-eye-height2-incr'), False),
    ('eye_space', 'Eye spacing', LR('eyes/*-eye-trans-in'), LR('eyes/*-eye-trans-out'), False),
    ('nose_width', 'Nose width', ['nose/nose-scale-horiz-decr'], ['nose/nose-scale-horiz-incr'], False),
    ('nose_length', 'Nose length', ['nose/nose-scale-vert-decr'], ['nose/nose-scale-vert-incr'], False),
    ('nose_tip', 'Nose tip down / up', ['nose/nose-point-down'], ['nose/nose-point-up'], False),
    ('nose_bridge', 'Nose bridge', ['nose/nose-hump-decr'], ['nose/nose-hump-incr'], False),
    ('lip_upper', 'Upper lip', ['mouth/mouth-upperlip-volume-decr'], ['mouth/mouth-upperlip-volume-incr'], False),
    ('lip_lower', 'Lower lip', ['mouth/mouth-lowerlip-volume-decr'], ['mouth/mouth-lowerlip-volume-incr'], False),
    ('mouth_width', 'Mouth width', ['mouth/mouth-scale-horiz-decr'], ['mouth/mouth-scale-horiz-incr'], False),
    ('mouth_corners', 'Mouth corners', ['mouth/mouth-angles-down'], ['mouth/mouth-angles-up'], False),
    ('mouth_height', 'Mouth height', ['mouth/mouth-trans-down'], ['mouth/mouth-trans-up'], False),
]
def tgt_delta(name):
    dl = {}
    for l in gzip.open(D + 'targets/' + name + '.target.gz', 'rt'):
        t = l.split()
        if len(t) == 4 and not l.startswith('#'): dl[int(t[0])] = np.array([float(t[1]), -float(t[3]), float(t[2])]) * 0.1
    return dl
if 'units' in sys.argv:
    for sid, label, neg, pos, mask in SHAPES:
        for tag, names in (('neg', neg), ('pos', pos)):
            if not names: continue
            tot = {}
            for nm in names:
                for i, dv in tgt_delta(nm).items(): tot[i] = tot.get(i, 0) + dv
            if mask: tot = {i: dv * min(1, max(0, (ez + 0.06 - B[i][2]) / 0.04)) for i, dv in tot.items()}
            for ob, idx in FACE:
                if not any(i in tot and np.abs(tot[i]).max() > 1e-6 for i in idx): continue
                if not ob.data.shape_keys: ob.shape_key_add(name='Basis')
                sk = ob.shape_key_add(name='f_%s_%s' % (sid, tag))
                for k_, i in enumerate(idx):
                    if i in tot: sk.data[k_].co = ob.data.vertices[k_].co + Vector(tot[i])
                sk.value = 0.0
    fpos_ = {int(i): k for k, i in enumerate(fv_)}                 # sculpt brushes as morph targets: slider value = millimetres
    for nm_, F_ in SCULPT_F.items():
        for ob, idx in FACE:
            if ob.name != 'body': continue
            if not ob.data.shape_keys: ob.shape_key_add(name='Basis')
            sk = ob.shape_key_add(name='s_' + nm_)
            for k, i in enumerate(idx):
                if i in fpos_: sk.data[k].co = sk.data[k].co + Vector(F_[fpos_[i]])
            sk.value = 0.0
    json.dump({'shapes': [dict(id=a_, label=b_, neg=c_, pos=d_) for a_, b_, c_, d_, _ in SHAPES], 'locks': LOCKS,
               'sculpts': [dict(id=n_, label=n_.replace('_', ' '), value=round(C['sculpt_brushes'].get(n_, 0) * C['sculpt'], 2)) for n_ in SCULPT_F],
               'sculptRef': dict(c=[0.0, float(ey + 0.065), float(ez - 0.01)], ylim=float(ey + 0.05), zmin=float(zchin - 0.02), stamps=C.get('sculpt_stamps', [])),
               'hair': {k_: C[k_] for k_ in ('hair_width_scale', 'hair_wave', 'hair_wave_freq', 'hair_strand_px', 'hair_curve', 'hair_edge_thin', 'hair_tip_len', 'hair_light', 'hair_mid', 'hair_dark', 'hair_rough')}},
              open(OUT + 'tool_data.json', 'w'), separators=(',', ':'))
for pname, preset in ({} if 'units' in sys.argv else C['expressions']).items():
    tot = {}
    for u, w in preset.items():
        for un in ([u.replace('-lr-', '-left-'), u.replace('-lr-', '-right-')] if '-lr-' in u else [u]):
            for i, dv in unit(un).items(): tot[i] = tot.get(i, 0) + w * dv
    for ob, idx in FACE:
        if not ob.data.shape_keys: ob.shape_key_add(name='Basis')
        sk = ob.shape_key_add(name='expr_' + pname); n_ = 0
        for k_, i in enumerate(idx):
            if i in tot: sk.data[k_].co = ob.data.vertices[k_].co + Vector(tot[i]); n_ += 1
        sk.value = 0.0
        print('EXPR', pname, ob.name, n_)

if 'teeth_ict' in bpy.data.objects and 'units' not in sys.argv:      # the kit's own motion of the lower teeth, gums and tongue for each expression (jaw open and the like)
    tq = bpy.data.objects['teeth_ict']; MQ = np.load('/home/claude/marla/ict_mouth_%s.npz' % ('shape3' if 'shape3' in sys.argv else 'profile2') if ('profile2' in sys.argv or 'shape3' in sys.argv) else '/home/claude/marla/ict_mouth.npz')
    for pname, preset in C['expressions'].items():
        sk = tq.data.shape_keys.key_blocks.get('expr_' + pname) if tq.data.shape_keys else None
        if sk is None: continue
        dq = np.zeros((len(tq.data.vertices), 3))
        for u, w in preset.items():
            if not u.startswith('ict-'): continue
            p_ = u.split('-'); keys_ = [p_[2] + '_L', p_[2] + '_R'] if p_[1] == 'lr' else ([p_[2] + {'left': '_L', 'right': '_R'}[p_[1]]] if p_[1] in ('left', 'right') else [p_[1]])
            for k_ in keys_:
                if 'mouthd_' + k_ in MQ: dq += w * MQ['mouthd_' + k_]
        base_ = np.array([v.co[:] for v in tq.data.vertices]); sk.data.foreach_set('co', (base_ + dq).ravel())
if 'grin' in C['expressions'] and 'units' not in sys.argv:
    tot = {}
    for u, w in C['expressions']['grin'].items():
        for un in ([u.replace('-lr-', '-left-'), u.replace('-lr-', '-right-')] if '-lr-' in u else [u]):
            for i, dv in unit(un).items(): tot[i] = tot.get(i, 0) + w * dv
    cl_, cw_, cd_ = C['crinkle']; CV = []; CG = []; CF = []
    def skin_at(x, z):
        d_ = (Pf[:, 0] - x) ** 2 + (Pf[:, 2] - z) ** 2 + 1e6 * (~fr_); o_ = np.argsort(d_)[:3]; w_ = 1 / (d_[o_] + 1e-8); w_ /= w_.sum()
        dv = sum(w_[q] * np.array(tot.get(int(fid[o_[q]]), (0, 0, 0))) for q in range(3))
        return float((Pf[o_, 1] * w_).sum()), dv
    for sg in (1, -1):
        cx, cz_ = sg * (ex + 0.0165), ez - 0.0005; y0, _ = skin_at(cx, cz_)
        for ang, ln in ((28, 0.85), (-4, 1.0), (-36, 0.85)):
            dx, dz = sg * math.cos(R_(ang)), math.sin(R_(ang)); b0 = len(CV)
            for q in range(4):
                t = q / 3; px, pz = cx + dx * (0.002 + cl_ * ln * t), cz_ + dz * (0.002 + cl_ * ln * t); wq = cw_ * (1 - 0.85 * t)
                for sd in (-1, 1):
                    qx, qz = px - dz * sd * wq / 2, pz + dx * sd * wq / 2; y_, dv = skin_at(qx, qz)
                    CG.append((qx + dv[0] + sg * 0.0012, y_ - 0.0014 + dv[1], qz + dv[2])); CV.append((cx, y0 + 0.002, cz_))
            for q in range(3): CF.append([b0 + q * 2, b0 + q * 2 + 1, b0 + q * 2 + 3, b0 + q * 2 + 2])
    crk = mk_raw('crinkle', CV, CF, None, bone='head')
    crk.data.materials.append(mat('crinkle', color=tuple((c_ / 255) ** 2.2 * cd_ for c_ in C['skin']), rough=0.6))
    crk.shape_key_add(name='Basis'); sk = crk.shape_key_add(name='expr_grin')
    for k_, p_ in enumerate(CG): sk.data[k_].co = Vector(p_)
    sk.value = 0.0

# ----------------------------------------------------------------- rig
am = bpy.data.armatures.new('rig'); ao = bpy.data.objects.new('rig', am); scn.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
for n, b in rig.items():
    eb = am.edit_bones.new(n); eb.head = jp(b['head']); eb.tail = jp(b['tail'])
    if (eb.tail - eb.head).length < 1e-4: eb.tail = eb.head + Vector((0, 0, .01))
    eb.roll = b.get('roll', 0)
for n, b in rig.items():
    if b['parent']: am.edit_bones[n].parent = am.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for ob in OBJS:
    md = ob.modifiers.new('arm', 'ARMATURE'); md.object = ao; ob.parent = ao

# ----------------------------------------------------------------- checks
rep = {'height_m': round(float(H), 3), 'heads_tall': round(float(H / (ztop - zchin)), 2), 'bones': len(am.bones), 'parts': {}}
tris = 0
for ob in OBJS:
    t = sum(len(p.vertices) - 2 for p in ob.data.polygons); tris += t; rep['parts'][ob.name] = t
rep['tris'] = tris
limb = {k: sum(1 for b in am.bones if b.name.startswith(k)) for k in ('upperarm', 'thigh', 'hand', 'foot', 'head', 'thumb_01', 'index_01', 'middle_01', 'ring_01', 'pinky_01')}
rep['limb_bones'] = limb
fails = []
if not 7.0 <= rep['heads_tall'] <= 8.0: fails.append('heads_tall %.2f outside 7-8' % rep['heads_tall'])
if limb != dict(upperarm=2, thigh=2, hand=2, foot=2, head=1, thumb_01=2, index_01=2, middle_01=2, ring_01=2, pinky_01=2): fails.append('limb count ' + str(limb))
if tris > 30000: fails.append('tris %d over 30000' % tris)
expected = ({'teeth_ict'} if 'teethict' in sys.argv else set()) | ({'brow_l', 'brow_r'} if 'brows2' in sys.argv else set()) | ({'gum_up'} if 'gum' in sys.argv else set()) | ({'cornea_l', 'cornea_r', 'eye_wet_l', 'eye_wet_r'} if 'eyes2' in sys.argv else set()) | {'body', 'eye_l', 'eye_r', 'lashes', 'teeth', 'suit', 'collar', 'coat', 'earring_l', 'earring_r', 'hair', 'crinkle', 'teeth_up', 'belt', 'buckle', 'wrap', 'clasp', 'strap', 'strap_b', 'patch'}
if not C.get('earrings', True): expected -= {'earring_l', 'earring_r'}
if not C.get('scout_kit', True): expected -= {'wrap', 'clasp', 'strap', 'strap_b', 'patch'}
if set(rep['parts']) != expected and not WHO: fails.append('unexpected parts ' + str(set(rep['parts']) ^ expected))
for ob in OBJS:
    bad = sum(1 for v in ob.data.vertices if len(v.groups) == 0 or len(v.groups) > 4)
    if bad: fails.append('%s: %d verts with 0 or >4 weights' % (ob.name, bad))
rep['fails'] = fails
json.dump(rep, open(OUT + 'report.json', 'w'), indent=1)
print('CHECK', 'PASS' if not fails else 'FAIL', json.dumps(rep))

# ----------------------------------------------------------------- export + render
# recruits (gen:N) walk about and are seen from further off, so they are thinned more than the named villagers
if GAME and (WHO or GEN):   # villagers in the game: neutral face only (no morphs), so the big meshes can be thinned to keep the download small
    for ob in [o_ for o_ in bpy.data.objects if o_.type == 'MESH']:
        n0 = len(ob.data.polygons)
        if n0 < (2000 if GEN else 3000) or ob.data.shape_keys or 'hair' in ob.name.lower() or 'lash' in ob.name.lower(): print('KEEP', ob.name, n0); continue
        bpy.context.view_layer.objects.active = ob; md = ob.modifiers.new('thin', 'DECIMATE'); md.ratio = C.get('game_decimate_recruit', 0.38) if GEN else C.get('game_decimate', 0.5); bpy.ops.object.modifier_apply(modifier='thin'); print('THIN', ob.name, n0, '->', len(ob.data.polygons))
bpy.ops.wm.save_as_mainfile(filepath=OUT + 'character01.blend')
GLBN = OUT + ('character_units.glb' if 'units' in sys.argv else 'character01.glb')
bpy.ops.export_scene.gltf(filepath=GLBN, export_format='GLB', export_image_format='AUTO', export_yup=True, export_animations=False, export_morph_normal=False, export_try_sparse_sk=True, export_normals=True, export_image_quality=80)
print('GLB MB', round(os.path.getsize(GLBN) / 1e6, 2))
if 'units' in sys.argv: sys.exit()
if 'norender' in sys.argv: sys.exit()
scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = C['skin2']['samples'] if 'skin2' in sys.argv else C['samples']; scn.cycles.use_denoising = True
scn.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.75, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = C['world']
def light(name, loc, power, color, size):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = power; l.color = color; l.size = size; l.shape = C.get('light_shape', 'DISK')      # round: a square light made square catchlights
    o = bpy.data.objects.new(name, l); scn.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, ez - 0.1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return o
SIDE = 'sidelight' in sys.argv      # key light from the side and above, weaker fill: shows folds on the face
light('key', (1.15, -1.5, ez + 0.8) if SIDE else (0.7, -1.8, ez + 0.6), C['key'][0] * (1.1 if SIDE else 1), C['key'][1], 0.8 if SIDE else 1.2)
light('rim', (-1.2, 1.7, ez + 0.4), C['rim'][0], C['rim'][1], 0.8)
light('fill', (-1.6, -1.6, ez) if SIDE else (1.6, -1.6, ez), C['fill'] * (0.55 if SIDE else 1), (1, 1, 1), 2.0)
cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); scn.collection.objects.link(co); scn.camera = co
def shot(name, loc, tgt, lens, res):
    cam.lens = lens; co.location = loc
    co.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scn.render.resolution_x, scn.render.resolution_y = res; scn.render.filepath = OUT + name + '.png'
    bpy.ops.render.render(write_still=True)
if 'expr' in sys.argv:
    from mathutils import Matrix
    names = []
    pb = ao.pose.bones['head']; M0 = pb.matrix.copy(); piv = M0.to_translation()
    ONLY = [a_[5:] for a_ in sys.argv if a_.startswith('only:')]
    for pn in [p_ for p_ in C['expr_render'] if not ONLY or p_ in ONLY]:
        for ob, _ in FACE:
            for kb in ob.data.shape_keys.key_blocks[1:]: kb.value = 1.0 if kb.name == 'expr_%s' % pn else 0.0
        if 'crinkle' in bpy.data.objects: bpy.data.objects['crinkle'].data.shape_keys.key_blocks['expr_grin'].value = 1.0 if pn in ('grin', 'smile_study5', 'smile_study5p', 'smile_study6', 'smile_study7') else 0.0
        ang = math.radians(C['expr_head_pitch'].get(pn, 0))
        pb.matrix = Matrix.Translation(piv) @ Matrix.Rotation(ang, 4, 'X') @ Matrix.Translation(-piv) @ M0
        bpy.context.view_layer.update()
        for nm, loc, tg in (('face', (0.0, -0.95, ez - 0.02), (0, -0.05, ez - 0.035)),):
            shot('e_%s_%s' % (pn, nm), loc, tg, 85, (520, 640)); names.append('e_%s_%s' % (pn, nm))
        if 'q34shot' in sys.argv: shot('e_%s_q34' % pn, (0.55, -0.78, ez - 0.02), (0.0, -0.05, ez - 0.035), 85, (520, 640))      # three-quarter view from her left
        if 'checkshot' in sys.argv: shot('e_%s_check' % pn, (0.0, -0.95, ez - 0.02), (0, -0.05, ez - 0.035), 85, (1040, 1280))      # double size front view for the proportion checker
        if 'sideshot' in sys.argv:
            for o_ in bpy.data.objects:
                if o_.name.startswith('hair') or o_.name in ('crinkle_hair',): o_.hide_render = True
            shot('e_%s_side' % pn, (0.95, -0.05, ez - 0.02), (0.0, -0.05, ez - 0.035), 85, (520, 640))      # profile from her left, hair hidden
            for o_ in bpy.data.objects:
                if o_.name.startswith('hair'): o_.hide_render = False
        if 'eyeshot' in sys.argv: shot('e_%s_eyes' % pn, (0.0, -0.42, ez + 0.002), (0, -0.05, ez), 85, (760, 300))
    tiles = [Image.open(OUT + n_ + '.png').convert('RGB') for n_ in names]
    if os.path.exists(C['ref_image']):
        r_ = Image.open(C['ref_image']).convert('RGB').crop(C['ref_crop']); r_ = r_.resize((int(r_.width * 640 / r_.height), 640), Image.LANCZOS)
        tiles = [r_] + tiles
    sh = Image.new('RGB', (sum(t_.width for t_ in tiles), 640)); x_ = 0
    for t_ in tiles: sh.paste(t_, (x_, 0)); x_ += t_.width
    sh.save(OUT + 'sheet_expr.png'); sys.exit()
shot('r_face', (0.30, -1.15, ez + 0.02), (0, -0.03, ez - 0.035), 85, (640, 800))
shot('r_body', (1.0, -3.9, 1.0), (0, 0, H * 0.5), 50, (450, 800))
shot('r_back', (-1.3, 3.6, 1.2), (0, 0, H * 0.5), 50, (450, 800))
shot('r_side', (-1.0, -0.35, ez + 0.03), (0, 0.0, ez - 0.05), 85, (640, 800))
ims = [Image.open(OUT + n + '.png').convert('RGB') for n in ('r_face', 'r_side', 'r_body', 'r_back')]
sh = Image.new('RGB', (640 * 2 + 450 * 2, 800)); x = 0
for im in ims: sh.paste(im, (x, 0)); x += im.width
sh.save(OUT + 'sheet01.png')
