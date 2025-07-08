'use client'

import { useState, useEffect } from 'react'
import { Storyboard, StoryboardShot, Story } from '@/types'

interface StoryboardEditorProps {
  story: Story
  storyboard: Storyboard | null
  onSave: (shots: StoryboardShot[]) => Promise<void>
  onGenerate: () => Promise<void>
  onGenerateVideo: () => void
  onAddShot?: (newShot: StoryboardShot) => Promise<void>
  onInsertShot?: (position: number, newShot: StoryboardShot) => Promise<void>
  onRemoveShot?: (position: number) => Promise<void>
  isLoading?: boolean
}

const cameraMovements = [
  { value: 'static', label: 'Static' },
  { value: 'dolly-in', label: 'Dolly In' },
  { value: 'dolly-out', label: 'Dolly Out' },
  { value: 'pan-left', label: 'Pan Left' },
  { value: 'pan-right', label: 'Pan Right' },
  { value: 'tilt-up', label: 'Tilt Up' },
  { value: 'tilt-down', label: 'Tilt Down' },
  { value: 'handheld', label: 'Handheld' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' }
] as const

const cameraAngles = [
  { value: 'eye-level', label: 'Eye Level' },
  { value: 'low-angle', label: 'Low Angle' },
  { value: 'high-angle', label: 'High Angle' },
  { value: 'bird-eye', label: 'Bird\'s Eye' },
  { value: 'worm-eye', label: 'Worm\'s Eye' }
] as const

const durations = [
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds' },
  { value: 16, label: '16 seconds' }
] as const

export function StoryboardEditor({ story, storyboard, onSave, onGenerate, onGenerateVideo, onAddShot, onInsertShot, onRemoveShot, isLoading = false }: StoryboardEditorProps) {
  const [editedShots, setEditedShots] = useState<StoryboardShot[]>(
    storyboard?.shots || [
      {
        promptText: '',
        duration: 5,
        camera: { movement: 'static', angle: 'eye-level' }
      },
      {
        promptText: '',
        duration: 5,
        camera: { movement: 'dolly-in', angle: 'eye-level' }
      },
      {
        promptText: '',
        duration: 5,
        camera: { movement: 'static', angle: 'eye-level' }
      }
    ]
  )

  // Update state when storyboard prop changes
  useEffect(() => {
    if (storyboard?.shots) {
      setEditedShots(storyboard.shots)
    }
  }, [storyboard])
  
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingShot, setIsAddingShot] = useState(false)
  const [newShotData, setNewShotData] = useState<StoryboardShot>({
    promptText: '',
    duration: 5,
    camera: { movement: 'static', angle: 'eye-level' }
  })
  const [insertPosition, setInsertPosition] = useState<number | null>(null)

  const updateShot = (index: number, field: keyof StoryboardShot, value: any) => {
    setEditedShots(prev => prev.map((shot, i) => 
      i === index ? { ...shot, [field]: value } : shot
    ))
  }

  const updateCameraProperty = (shotIndex: number, property: 'movement' | 'angle', value: string) => {
    setEditedShots(prev => prev.map((shot, i) => 
      i === shotIndex 
        ? { 
            ...shot, 
            camera: { 
              ...shot.camera, 
              [property]: value 
            } 
          } 
        : shot
    ))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(editedShots)
    } finally {
      setIsSaving(false)
    }
  }

  const getTotalDuration = () => {
    return editedShots.reduce((total, shot) => total + shot.duration, 0)
  }

  const isValidForSave = () => {
    return editedShots.every(shot => 
      shot.promptText.trim().length > 0 && 
      [5, 10, 16].includes(shot.duration)
    )
  }

  const handleAddShot = async () => {
    if (!onAddShot || !newShotData.promptText.trim()) return
    
    setIsAddingShot(true)
    try {
      await onAddShot(newShotData)
      setNewShotData({
        promptText: '',
        duration: 5,
        camera: { movement: 'static', angle: 'eye-level' }
      })
    } finally {
      setIsAddingShot(false)
    }
  }

  const handleInsertShot = async (position: number) => {
    if (!onInsertShot || !newShotData.promptText.trim()) return
    
    setIsAddingShot(true)
    try {
      await onInsertShot(position, newShotData)
      setNewShotData({
        promptText: '',
        duration: 5,
        camera: { movement: 'static', angle: 'eye-level' }
      })
      setInsertPosition(null)
    } finally {
      setIsAddingShot(false)
    }
  }

  const handleRemoveShot = async (position: number) => {
    if (!onRemoveShot) return
    
    const confirmed = window.confirm('Are you sure you want to remove this shot?')
    if (!confirmed) return
    
    try {
      await onRemoveShot(position)
    } catch (error) {
      console.error('Failed to remove shot:', error)
    }
  }

  const updateNewShotData = (field: keyof StoryboardShot, value: any) => {
    setNewShotData(prev => ({ ...prev, [field]: value }))
  }

  const updateNewShotCamera = (property: 'movement' | 'angle', value: string) => {
    setNewShotData(prev => ({
      ...prev,
      camera: { ...prev.camera, [property]: value }
    }))
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-gray-600 mb-2">Edit your storyboard for "{story.headline}"</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Total Duration: <strong>{getTotalDuration()}s</strong></span>
          <span>Format: <strong>Portrait (768:1280)</strong></span>
          <span>Model: <strong>Runway Gen-4 Turbo</strong></span>
        </div>
      </div>

      {!storyboard && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">No Storyboard Generated Yet</h3>
          <p className="text-blue-700 text-sm mb-3">
            Generate a storyboard using AI, then customize each shot to your preferences and create reference images.
          </p>
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate Storyboard'}
          </button>
        </div>
      )}

      <div className="space-y-8">
        {editedShots.map((shot, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Shot {index + 1}
              </h3>
              <div className="flex items-center gap-2">
                {onInsertShot && (
                  <button
                    onClick={() => setInsertPosition(index)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                    title="Insert shot before this one"
                  >
                    + Insert
                  </button>
                )}
                <select
                  value={shot.duration}
                  onChange={(e) => updateShot(index, 'duration', parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  {durations.map(duration => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
                {onRemoveShot && editedShots.length > 1 && (
                  <button
                    onClick={() => handleRemoveShot(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                    title="Remove this shot"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Prompt Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visual Description
                </label>
                <textarea
                  value={shot.promptText}
                  onChange={(e) => updateShot(index, 'promptText', e.target.value)}
                  placeholder={`Describe the visual content for shot ${index + 1}...`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tip: Be specific about framing, lighting, and action for best results
                </p>
              </div>

              {/* Camera Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera Movement
                  </label>
                  <select
                    value={shot.camera?.movement || 'static'}
                    onChange={(e) => updateCameraProperty(index, 'movement', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {cameraMovements.map(movement => (
                      <option key={movement.value} value={movement.value}>
                        {movement.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera Angle
                  </label>
                  <select
                    value={shot.camera?.angle || 'eye-level'}
                    onChange={(e) => updateCameraProperty(index, 'angle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {cameraAngles.map(angle => (
                      <option key={angle.value} value={angle.value}>
                        {angle.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shot Preview */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <strong>Preview:</strong> {shot.duration}s {shot.camera?.movement} {shot.camera?.angle} shot
                  {shot.promptText ? ` - ${shot.promptText}` : ' - No description yet'}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Insert Shot Form */}
        {insertPosition !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">
              Insert New Shot at Position {insertPosition + 1}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visual Description
                </label>
                <textarea
                  value={newShotData.promptText}
                  onChange={(e) => updateNewShotData('promptText', e.target.value)}
                  placeholder="Describe the visual content for this shot..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration
                  </label>
                  <select
                    value={newShotData.duration}
                    onChange={(e) => updateNewShotData('duration', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {durations.map(duration => (
                      <option key={duration.value} value={duration.value}>
                        {duration.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera Movement
                  </label>
                  <select
                    value={newShotData.camera?.movement || 'static'}
                    onChange={(e) => updateNewShotCamera('movement', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {cameraMovements.map(movement => (
                      <option key={movement.value} value={movement.value}>
                        {movement.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera Angle
                  </label>
                  <select
                    value={newShotData.camera?.angle || 'eye-level'}
                    onChange={(e) => updateNewShotCamera('angle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {cameraAngles.map(angle => (
                      <option key={angle.value} value={angle.value}>
                        {angle.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleInsertShot(insertPosition)}
                  disabled={!newShotData.promptText.trim() || isAddingShot}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingShot ? 'Inserting...' : 'Insert Shot'}
                </button>
                <button
                  onClick={() => setInsertPosition(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Shot Form */}
        {onAddShot && storyboard && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">
              Add New Shot
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visual Description
                </label>
                <textarea
                  value={newShotData.promptText}
                  onChange={(e) => updateNewShotData('promptText', e.target.value)}
                  placeholder="Describe the visual content for this shot..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration
                  </label>
                  <select
                    value={newShotData.duration}
                    onChange={(e) => updateNewShotData('duration', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {durations.map(duration => (
                      <option key={duration.value} value={duration.value}>
                        {duration.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera Movement
                  </label>
                  <select
                    value={newShotData.camera?.movement || 'static'}
                    onChange={(e) => updateNewShotCamera('movement', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {cameraMovements.map(movement => (
                      <option key={movement.value} value={movement.value}>
                        {movement.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera Angle
                  </label>
                  <select
                    value={newShotData.camera?.angle || 'eye-level'}
                    onChange={(e) => updateNewShotCamera('angle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {cameraAngles.map(angle => (
                      <option key={angle.value} value={angle.value}>
                        {angle.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <button
                  onClick={handleAddShot}
                  disabled={!newShotData.promptText.trim() || isAddingShot}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingShot ? 'Adding...' : 'Add Shot'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex gap-3">
          {storyboard && (
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Regenerating...' : 'Regenerate Storyboard'}
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!isValidForSave() || isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          
          <button
            onClick={onGenerateVideo}
            disabled={!storyboard || !isValidForSave()}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Video
          </button>
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-3">Storyboard Tips</h4>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• <strong>Start with 2-3 shots:</strong> Establish scene, focus on key details, conclude with resolution</li>
          <li>• <strong>Generate reference images:</strong> Visualize shots before video creation</li>
          <li>• Use specific visual language: "cinematic lighting", "handheld camera", "shallow depth of field"</li>
          <li>• Camera movements add dynamism but use sparingly for news content</li>
          <li>• Total duration should be 15-20 seconds for optimal social media engagement</li>
        </ul>
      </div>
    </div>
  )
} 