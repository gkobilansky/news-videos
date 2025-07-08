'use client'

import { useState, useEffect } from 'react'
import { Storyboard, StoryboardShot, Story } from '@/types'

interface StoryboardEditorProps {
  story: Story
  storyboard: Storyboard | null
  onSave: (shots: StoryboardShot[]) => Promise<void>
  onGenerate: () => Promise<void>
  onGenerateVideo: () => void
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

export function StoryboardEditor({ story, storyboard, onSave, onGenerate, onGenerateVideo, isLoading = false }: StoryboardEditorProps) {
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Storyboard Editor</h1>
        <p className="text-gray-600">Edit your 3-shot storyboard for "{story.headline}"</p>
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
          <span>Total Duration: <strong>{getTotalDuration()}s</strong></span>
          <span>Format: <strong>Portrait (768:1280)</strong></span>
          <span>Model: <strong>Runway Gen-4 Turbo</strong></span>
        </div>
      </div>

      {!storyboard && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">No Storyboard Generated Yet</h3>
          <p className="text-blue-700 text-sm mb-3">
            Generate a 3-shot storyboard using AI, then customize each shot to your preferences.
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
          <li>• <strong>Shot 1:</strong> Establish the scene with a wide or medium shot</li>
          <li>• <strong>Shot 2:</strong> Focus on key details or subjects with close-ups</li>
          <li>• <strong>Shot 3:</strong> Conclude with resolution or wider context</li>
          <li>• Use specific visual language: "cinematic lighting", "handheld camera", "shallow depth of field"</li>
          <li>• Camera movements add dynamism but use sparingly for news content</li>
          <li>• Total duration should be 15-20 seconds for optimal social media engagement</li>
        </ul>
      </div>
    </div>
  )
} 