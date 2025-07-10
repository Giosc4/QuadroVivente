
# File: create_container.py
# questo file contiene il codice per creare un box in Blender per il progetto "Quadro Vivente"


import bpy
import bmesh
from mathutils import Vector

def clear_mesh():
    """Pulisce la scena eliminando tutti i mesh"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False, confirm=False)

def create_quadro_vivente_box():
    """Crea il box per il progetto Quadro Vivente"""
    
    # Dimensioni del box (in cm convertite in unità Blender)
    box_width = 6.0    # X
    box_depth = 5.0    # Y  
    box_height = 4.0   # Z
    wall_thickness = 0.2  # Spessore pareti
    panel_thickness = 0.15  # Spessore pannello scorrevole
    
    # Pulisce la scena
    clear_mesh()
    
    # Crea il box esterno
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, box_height/2))
    outer_box = bpy.context.active_object
    outer_box.name = "QuadroVivente_Box_Outer"
    outer_box.scale = (box_width, box_depth, box_height)
    bpy.ops.object.transform_apply(scale=True)
    
    # Crea il box interno (per svuotare)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, (box_height-wall_thickness)/2))
    inner_box = bpy.context.active_object
    inner_box.name = "QuadroVivente_Box_Inner"
    inner_box.scale = (box_width-wall_thickness*2, box_depth-wall_thickness*2, box_height-wall_thickness)
    bpy.ops.object.transform_apply(scale=True)
    
    # Seleziona entrambi i box per la differenza booleana
    bpy.ops.object.select_all(action='DESELECT')
    outer_box.select_set(True)
    inner_box.select_set(True)
    bpy.context.view_layer.objects.active = outer_box
    
    # Applica modificatore booleano per svuotare
    boolean_modifier = outer_box.modifiers.new(name="Boolean", type='BOOLEAN')
    boolean_modifier.operation = 'DIFFERENCE'
    boolean_modifier.object = inner_box
    bpy.ops.object.modifier_apply(modifier="Boolean")
    
    # Elimina il box interno
    bpy.ops.object.select_all(action='DESELECT')
    inner_box.select_set(True)
    bpy.ops.object.delete()
    
    # Seleziona il box principale
    bpy.ops.object.select_all(action='DESELECT')
    outer_box.select_set(True)
    bpy.context.view_layer.objects.active = outer_box
    
    # === APERTURA INFERIORE PER PANNELLO SCORREVOLE ===
    
    # Crea l'apertura nella parte inferiore (lasciando i bordi per le guide)
    bottom_opening = create_rectangular_hole(
        location=(0, 0.5, panel_thickness/2),  # Spostato verso il retro per lasciare spazio al bordo anteriore
        width=box_width - wall_thickness*2,
        height=panel_thickness + 0.1,
        depth=box_depth - wall_thickness*2 - 1.0,  # Lascia 1cm sul bordo anteriore
        name="Bottom_Opening"
    )
    apply_boolean_difference(outer_box, bottom_opening)
    
    # === GUIDE PER IL PANNELLO SCORREVOLE ===
    
    # Crea guide sui lati lunghi (anteriore e posteriore) invece che sui lati corti
    guide_depth = 0.1
    guide_height = 0.4
    
    # Guida anteriore (dove si inserisce il pannello)
    front_guide = create_rectangular_hole(
        location=(0, -(box_depth-wall_thickness*2)/2 + guide_depth/2, guide_height/2),
        width=box_width - wall_thickness*2,
        height=guide_height,
        depth=guide_depth,
        name="Front_Guide"
    )
    apply_boolean_difference(outer_box, front_guide)
    
    # Guida posteriore (dove esce il pannello)
    back_guide = create_rectangular_hole(
        location=(0, (box_depth-wall_thickness*2)/2 - guide_depth/2, guide_height/2),
        width=box_width - wall_thickness*2,
        height=guide_height,
        depth=guide_depth,
        name="Back_Guide"
    )
    apply_boolean_difference(outer_box, back_guide)
    
    # === FORI PER SENSORI NELLA PARTE SUPERIORE (CILINDRICI) ===
    
    # Foro per DHT11 (sensore temperatura/umidità)
    dht11_hole = create_cylinder_hole(
        location=(1.5, 0.8, box_height - wall_thickness/2),
        radius=0.5,  # 10mm diametro per DHT11
        height=wall_thickness + 0.1,
        name="DHT11_Hole"
    )
    apply_boolean_difference(outer_box, dht11_hole)
    
    # Foro per MAX9814 (microfono amplificatore)
    max9814_hole = create_cylinder_hole(
        location=(-1.5, 0.8, box_height - wall_thickness/2),
        radius=0.6,  # 12mm diametro per MAX9814
        height=wall_thickness + 0.1,
        name="MAX9814_Hole"
    )
    apply_boolean_difference(outer_box, max9814_hole)
    
    # Foro per LDR (fotoresistenza)
    ldr_hole = create_cylinder_hole(
        location=(0, -1.0, box_height - wall_thickness/2),
        radius=0.4,  # 8mm diametro per LDR
        height=wall_thickness + 0.1,
        name="LDR_Hole"
    )
    apply_boolean_difference(outer_box, ldr_hole)
    
    # === FORO LATERALE QUADRATO PER ESP32 E ALIMENTAZIONE ===
    
    # Foro quadrato per accesso ESP32 e cavi
    esp32_hole = create_rectangular_hole(
        location=(box_width/2 - wall_thickness/2, 0, 1.5),
        width=wall_thickness + 0.1,
        height=2.0,  # Foro quadrato 20x20mm
        depth=2.0,   # Foro quadrato 20x20mm
        name="ESP32_Square_Hole"
    )
    apply_boolean_difference(outer_box, esp32_hole)
    
    # === FORI DI VENTILAZIONE AGGIUNTIVI ===
    
    # Piccoli fori per ventilazione sui lati
    ventilation_positions = [
        (-box_width/2 + wall_thickness/2, 1.8, 2.5),  # Lato sinistro
        (-box_width/2 + wall_thickness/2, -1.8, 2.5), # Lato sinistro
        (0, box_depth/2 - wall_thickness/2, 2.5),     # Lato posteriore
        (0, -box_depth/2 + wall_thickness/2, 2.5)     # Lato anteriore
    ]
    
    for i, pos in enumerate(ventilation_positions):
        vent_hole = create_cylinder_hole(
            location=pos,
            radius=0.2,
            height=wall_thickness + 0.1,
            name=f"Vent_Hole_{i+1}"
        )
        if abs(pos[0]) > 1:  # Fori laterali in X
            vent_hole.rotation_euler = (0, 1.5708, 0)  # 90 gradi su Y
        else:  # Fori laterali in Y
            vent_hole.rotation_euler = (1.5708, 0, 0)  # 90 gradi su X
        apply_boolean_difference(outer_box, vent_hole)
    
    # === PANNELLO SCORREVOLE INFERIORE ===
    
    # Crea il pannello scorrevole che chiude l'apertura dal basso
    panel_width = box_width - wall_thickness*2 - 0.1  # Leggermente più piccolo per scorrere
    panel_depth = box_depth - wall_thickness*2 - 1.0 - 0.1  # Corrisponde all'apertura
    
    # Posiziona il pannello davanti al box (da dove si inserisce)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -(box_depth/2 + 1.0), panel_thickness/2))
    sliding_panel = bpy.context.active_object
    sliding_panel.name = "QuadroVivente_Sliding_Panel"
    sliding_panel.scale = (panel_width, panel_depth, panel_thickness)
    bpy.ops.object.transform_apply(scale=True)
    
    # Aggiungi le guide al pannello (sopra e sotto)
    guide_width = box_width - wall_thickness*2 - 0.1
    guide_panel_depth = guide_depth - 0.02  # Leggermente più piccolo per scorrere
    guide_panel_height = guide_height - 0.02
    
    # Guida anteriore del pannello (che si inserisce nella guida front del box)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -(box_depth/2 + 1.0) - panel_depth/2 + guide_panel_depth/2, panel_thickness/2 + guide_panel_height/2))
    front_panel_guide = bpy.context.active_object
    front_panel_guide.name = "Panel_Front_Guide"
    front_panel_guide.scale = (guide_width, guide_panel_depth, guide_panel_height)
    bpy.ops.object.transform_apply(scale=True)
    
    # Unisci la guida anteriore al pannello
    bpy.ops.object.select_all(action='DESELECT')
    sliding_panel.select_set(True)
    front_panel_guide.select_set(True)
    bpy.context.view_layer.objects.active = sliding_panel
    bpy.ops.object.join()
    
    # Guida posteriore del pannello (che si inserisce nella guida back del box)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -(box_depth/2 + 1.0) + panel_depth/2 - guide_panel_depth/2, panel_thickness/2 + guide_panel_height/2))
    back_panel_guide = bpy.context.active_object
    back_panel_guide.name = "Panel_Back_Guide"
    back_panel_guide.scale = (guide_width, guide_panel_depth, guide_panel_height)
    bpy.ops.object.transform_apply(scale=True)
    
    # Unisci la guida posteriore al pannello
    bpy.ops.object.select_all(action='DESELECT')
    sliding_panel.select_set(True)
    back_panel_guide.select_set(True)
    bpy.context.view_layer.objects.active = sliding_panel
    bpy.ops.object.join()
    
    # Aggiungi una maniglia al pannello per facilità di estrazione
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -(box_depth/2 + 1.5), panel_thickness/2 + 0.2))
    handle = bpy.context.active_object
    handle.name = "Panel_Handle"
    handle.scale = (2.0, 0.4, 0.3)
    bpy.ops.object.transform_apply(scale=True)
    
    # Unisci la maniglia al pannello
    bpy.ops.object.select_all(action='DESELECT')
    sliding_panel.select_set(True)
    handle.select_set(True)
    bpy.context.view_layer.objects.active = sliding_panel
    bpy.ops.object.join()
    
    # Seleziona il box principale alla fine
    bpy.ops.object.select_all(action='DESELECT')
    outer_box.select_set(True)
    bpy.context.view_layer.objects.active = outer_box
    
    print("Box Quadro Vivente con pannello scorrevole creato con successo!")
    print("Dimensioni: 6x5x4 cm")
    print("3 Fori sensori cilindrici: DHT11 (ø10mm), MAX9814 (ø12mm), LDR (ø8mm)")
    print("Foro laterale quadrato: ESP32 (20x20mm)")
    print("")
    print("🔧 SISTEMA DI CHIUSURA:")
    print("1. Box principale: apertura sul fondo con bordo anteriore")
    print("2. Pannello scorrevole: si inserisce DA DAVANTI VERSO DIETRO")
    print("3. Guide: scanalature anteriore e posteriore per scorrimento")
    print("4. Maniglia: per tirare ed estrarre il pannello")
    print("5. Chiusura: spingere il pannello dentro per chiudere il box")
    print("")
    print("Ventilazione: 4 fori laterali")
    print("Sistema: componenti liberi all'interno, accesso totale dal basso")

def create_cylinder_hole(location, radius, height, name):
    """Crea un cilindro per fare un foro"""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=height,
        location=location
    )
    hole = bpy.context.active_object
    hole.name = name
    return hole

def create_rectangular_hole(location, width, height, depth, name):
    """Crea un cubo per fare un foro rettangolare"""
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=location
    )
    hole = bpy.context.active_object
    hole.name = name
    hole.scale = (width, depth, height)
    bpy.ops.object.transform_apply(scale=True)
    return hole

def apply_boolean_difference(target, cutter):
    """Applica una differenza booleana tra due oggetti"""
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    
    boolean_modifier = target.modifiers.new(name="Boolean", type='BOOLEAN')
    boolean_modifier.operation = 'DIFFERENCE'
    boolean_modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier="Boolean")
    
    # Elimina l'oggetto usato per il taglio
    bpy.ops.object.select_all(action='DESELECT')
    cutter.select_set(True)
    bpy.ops.object.delete()

# Esegui la funzione principale
if __name__ == "__main__":
    create_quadro_vivente_box()