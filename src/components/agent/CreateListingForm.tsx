import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, X, Plus, Info, Camera, ArrowRight, Check, Building, Image, ThumbsUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const listingSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  price: z.coerce.number().positive('Price must be a positive number'),
  location: z.string().min(3, 'Location must be at least 3 characters'),
  city: z.enum([
    'Addis Ababa',
    'Arada',
    'Bole',
    'Gulele',
    'Kirkos',
    'Kolfe Keranio',
    'Lideta',
    'Nifas Silk-Lafto',
    'Yeka',
    'Akaki Kality',
    'Addis Ketema',
    'Alem Gena',
    'Bole Bulbula',
    'Gerji',
    'Gotera',
    'Kality',
    'Kotebe',
    'Lafto',
    'Megenagna',
    'Merkato',
    'Saris',
    'Saris Abo',
    'Summit',
    'Tulu Dimtu',
    'Wello Sefer'
  ], {
    required_error: 'Please select a city',
  }),
  phone_number: z.string().optional(),
  whatsapp_link: z.string().optional(),
  telegram_link: z.string().optional(),
  progress_status: z.enum(['excavation', 'on_progress', 'semi_finished', 'fully_finished']),
  down_payment_percent: z.coerce.number().min(0).max(100).optional(),
  bank_option: z.boolean().default(false)
});

type ListingFormValues = z.infer<typeof listingSchema>;

interface CreateListingFormProps {
  onSuccess: () => void;
}

const CreateListingForm = ({ onSuccess }: CreateListingFormProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [additionalImagePreviews, setAdditionalImagePreviews] = useState<string[]>([]);
  
  // Form step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Add this near other state declarations
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [publicListingUrl, setPublicListingUrl] = useState('');

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: '',
      description: '',
      price: undefined,
      location: '',
      city: 'Addis Ababa', // Set default city to match the enum type
      phone_number: '',
      whatsapp_link: '',
      telegram_link: '',
      progress_status: 'fully_finished',
      down_payment_percent: undefined,
      bank_option: false
    }
  });

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMainImage(file);
      setMainImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAdditionalImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setAdditionalImages(prev => [...prev, ...filesArray]);
      
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setAdditionalImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeMainImage = () => {
    setMainImage(null);
    setMainImagePreview(null);
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index));
    setAdditionalImagePreviews(prev => {
      // Revoke the URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Navigation functions for multi-step form
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
      window.scrollTo(0, 0);
    }
  };

  // Validate current step before proceeding
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        // Property Details validation
        const step1Fields: (keyof ListingFormValues)[] = ['title', 'description', 'price', 'location', 'city'];
        const isStep1Valid = await form.trigger(step1Fields);
        if (!isStep1Valid) {
          const firstError = step1Fields.find(field => form.formState.errors[field]);
          if (firstError) {
            const element = document.getElementById(firstError);
            if (element) {
              form.setFocus(firstError);
            }
          }
        }
        return isStep1Valid;
      case 2:
        // Property Images validation - require at least main image
        if (!mainImage) {
          return false;
        }
        return true;
      case 3:
        // Prevent automatic validation/submission when reaching step 3
        return false;
      default:
        return false;
    }
  };

  const handleNextStep = async () => {
    // Special handling for step 2 to step 3 transition
    if (currentStep === 2) {
      if (mainImage) {
        nextStep(); // Simply advance to step 3 if we have a main image
      } else {
        window.scrollTo(0, 0);
      }
      return;
    }

    // Handle other step transitions
    const isValid = await validateStep(currentStep);
    if (isValid) {
      nextStep();
    } else {
      window.scrollTo(0, 0);
    }
  };

  // Add debug logging for mount/unmount
  useEffect(() => {
    console.log('[CreateListingForm] Mounted');
    return () => {
      console.log('[CreateListingForm] Unmounted');
    };
  }, []);

  // Add debug logging for dialog state
  useEffect(() => {
    console.log('[CreateListingForm] showSuccessPopup:', showSuccessPopup);
  }, [showSuccessPopup]);

  const onSubmit = async (values: ListingFormValues) => {
    // Only proceed if submit was actually attempted (button clicked)
    if (!submitAttempted) {
      return;
    }

    if (!user) {
      return;
    }

    if (!mainImage) {
      setCurrentStep(2);
      return;
    }
    
    // Check all required fields from all steps
    const requiredFieldsValid = 
      values.title && 
      values.description && 
      values.price && 
      values.location &&
      values.city;
    
    if (!requiredFieldsValid) {
      // Go back to the first step
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload main image
      const mainImageFileName = `${user.id}/${Date.now()}-${mainImage.name}`;
      const { data: mainImageData, error: mainImageError } = await supabase.storage
        .from('listing-images')
        .upload(mainImageFileName, mainImage);

      if (mainImageError) throw mainImageError;

      // Get the public URL for the main image
      const { data: mainImagePublicUrl } = supabase.storage
        .from('listing-images')
        .getPublicUrl(mainImageFileName);

      // 2. Upload additional images if any
      const additionalImageUrls: string[] = [];
      
      for (let i = 0; i < additionalImages.length; i++) {
        const file = additionalImages[i];
        const fileName = `${user.id}/${Date.now()}-${i}-${file.name}`;
        
        const { data: additionalImageData, error: additionalImageError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, file);
          
        if (additionalImageError) {
          console.error(`Error uploading additional image ${i}:`, additionalImageError);
          continue;
        }
        
        const { data: publicUrl } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName);
          
        additionalImageUrls.push(publicUrl.publicUrl);
      }

      // 3. Create the listing record in the database
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert([
          {
          title: values.title,
          description: values.description,
          price: values.price,
          location: values.location,
            city: values.city,
          main_image_url: mainImagePublicUrl.publicUrl,
          additional_image_urls: additionalImageUrls.length > 0 ? additionalImageUrls : null,
            user_id: user.id,
            status: 'pending',
          phone_number: values.phone_number || null,
          whatsapp_link: values.whatsapp_link || null,
            telegram_link: values.telegram_link || null,
            progress_status: values.progress_status,
            down_payment_percent: values.down_payment_percent,
            bank_option: values.bank_option
          }
        ])
        .select()
        .single();

      if (listingError) throw listingError;

      // Fetch the agent's profile to get their slug
      const { data: agentProfile, error: agentError } = await supabase
        .from('profiles')
        .select('slug')
        .eq('id', user.id)
        .single();

      if (agentError) throw agentError;

      // Set the public listing URL with the agent's slug
      setPublicListingUrl(`/${agentProfile.slug}/listing/${listing.id}`);
      
      // Reset form and state
      form.reset();
      setMainImage(null);
      setMainImagePreview(null);
      setAdditionalImages([]);
      setAdditionalImagePreviews([]);
      setCurrentStep(1);
      
      // Show success popup
      setShowSuccessPopup(true);
    } catch (error: any) {
      console.error('Failed to create listing:', error);
    } finally {
      setIsSubmitting(false);
      setSubmitAttempted(false);
    }
  };

  return (
    <>
      <div className="bg-[var(--portal-card-bg)] rounded-lg shadow-md border border-[var(--portal-border)]">
        <div className="border-b border-[var(--portal-border)] p-6 bg-gradient-to-r from-[var(--portal-bg)] to-[var(--portal-card-bg)]">
          <h2 className="text-2xl font-semibold text-[var(--portal-text)]">Create New Listing</h2>
          <p className="text-[var(--portal-text-secondary)] mt-1">Fill out the form to create a new property listing</p>
      </div>
      
        {/* Progress bar */}
        <div className="px-8 pt-6">
          <div className="flex items-center mb-4">
            {[1, 2, 3].map((mapStep) => (
              <div key={mapStep} style={{ display: 'contents' }}>
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentStep >= mapStep 
                      ? 'bg-gold-500 text-black' 
                      : 'bg-[var(--portal-bg-hover)] text-[var(--portal-text-secondary)]'
                  } transition-colors cursor-pointer font-medium text-sm`}
                  onClick={async () => {
                    if (mapStep < currentStep) { // Allow navigating to previous steps freely
                      goToStep(mapStep);
                    } else if (mapStep === currentStep) { // Clicking current step
                      await validateStep(currentStep);
                      window.scrollTo(0,0);
                    } else if (mapStep === 3) { // Trying to jump to step 3
                      // Don't allow direct jump to step 3
                      const canLeaveCurrentStep = await validateStep(currentStep);
                      if (canLeaveCurrentStep && currentStep === 2) {
                        goToStep(mapStep);
                      } else {
                        window.scrollTo(0,0);
                      }
                    } else { // Other forward navigation
                      const canLeaveCurrentStep = await validateStep(currentStep);
                      if (canLeaveCurrentStep) {
                        goToStep(mapStep);
                      } else {
                        window.scrollTo(0,0);
                      }
                    }
                  }}
                >
                  {mapStep}
                </div>
                {mapStep < 3 && (
                  <div 
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > mapStep 
                        ? 'bg-gold-500' 
                        : 'bg-[var(--portal-bg-hover)]'
                    } transition-colors`} 
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-[var(--portal-text-secondary)] mb-6">
            <div className={currentStep === 1 ? 'text-gold-500 font-medium' : ''}>Property Details</div>
            <div className={currentStep === 2 ? 'text-gold-500 font-medium' : ''}>Property Images</div>
            <div className={currentStep === 3 ? 'text-gold-500 font-medium' : ''}>Contact Information</div>
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={e => {
            if (currentStep === 3 && e.key === 'Enter') {
              e.preventDefault();
            }
          }}
          className="p-8 pt-2"
        >
          <div className="space-y-10">
            {/* Property Details Step */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 gap-8">
                  <div className="col-span-1">
                    <label htmlFor="title" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input 
                      id="title"
                      type="text"
                      required
                      placeholder="e.g. Modern 2 Bedroom Apartment"
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                      {...form.register('title')}
                      autoComplete="off"
                    />
                    {form.formState.errors.title && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.title.message}</p>
                    )}
                  </div>

                  {/* Responsive grid for Price and Location */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="col-span-1">
                      <label htmlFor="price" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                        Price (ETB) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="price"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        placeholder="e.g. 150000"
                        className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                        {...form.register('price')}
                        autoComplete="off"
                      />
                      {form.formState.errors.price && (
                        <p className="mt-1 text-sm text-red-500">{form.formState.errors.price.message}</p>
                      )}
                    </div>
                    <div className="col-span-1">
                      <label htmlFor="location" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <input 
                        id="location"
                        type="text"
                        required
                        placeholder="e.g. Addis Ababa"
                        className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                        {...form.register('location')}
                        autoComplete="off"
                      />
                      {form.formState.errors.location && (
                        <p className="mt-1 text-sm text-red-500">{form.formState.errors.location.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="city" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <select 
                      id="city"
                      required
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                      {...form.register('city')}
                    >
                      <option value="">Select a city</option>
                      <option value="Addis Ababa">Addis Ababa</option>
                      <option value="Arada">Arada</option>
                      <option value="Bole">Bole</option>
                      <option value="Gulele">Gulele</option>
                      <option value="Kirkos">Kirkos</option>
                      <option value="Kolfe Keranio">Kolfe Keranio</option>
                      <option value="Lideta">Lideta</option>
                      <option value="Nifas Silk-Lafto">Nifas Silk-Lafto</option>
                      <option value="Yeka">Yeka</option>
                      <option value="Akaki Kality">Akaki Kality</option>
                      <option value="Addis Ketema">Addis Ketema</option>
                      <option value="Alem Gena">Alem Gena</option>
                      <option value="Bole Bulbula">Bole Bulbula</option>
                      <option value="Gerji">Gerji</option>
                      <option value="Gotera">Gotera</option>
                      <option value="Kality">Kality</option>
                      <option value="Kotebe">Kotebe</option>
                      <option value="Lafto">Lafto</option>
                      <option value="Megenagna">Megenagna</option>
                      <option value="Merkato">Merkato</option>
                      <option value="Saris">Saris</option>
                      <option value="Saris Abo">Saris Abo</option>
                      <option value="Summit">Summit</option>
                      <option value="Tulu Dimtu">Tulu Dimtu</option>
                      <option value="Wello Sefer">Wello Sefer</option>
                    </select>
                    {form.formState.errors.city && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.city.message}</p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="progress_status" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      Progress Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="progress_status"
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                      {...form.register('progress_status')}
                    >
                      <option value="excavation">Excavation (ቁፋሮ)</option>
                      <option value="on_progress">On Progress</option>
                      <option value="semi_finished">Semi-finished</option>
                      <option value="fully_finished">Fully Finished</option>
                    </select>
                    {form.formState.errors.progress_status && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.progress_status.message}</p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="down_payment_percent" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      Down Payment (%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="down_payment_percent"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 20"
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                      {...form.register('down_payment_percent')}
                    />
                    {form.formState.errors.down_payment_percent && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.down_payment_percent.message}</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="bank_option"
                        className="h-4 w-4 rounded border-[var(--portal-input-border)] text-gold-500 focus:ring-gold-500"
                        {...form.register('bank_option')}
                      />
                      <label htmlFor="bank_option" className="text-sm font-medium text-[var(--portal-label-text)]">
                        Bank Option Available
                      </label>
                    </div>
                    {form.formState.errors.bank_option && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.bank_option.message}</p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="description" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      Description <span className="text-red-500">*</span>
                  </label>
                    <textarea
                      id="description"
                      rows={5}
                      required
                      placeholder="Describe the property..."
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all resize-none"
                      {...form.register('description')}
                      autoComplete="off"
                    />
                    {form.formState.errors.description && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.description.message}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Property Images Step */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <label className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                    Main Image <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-[var(--portal-border)] rounded-lg bg-[var(--portal-bg)]/40">
                    <div className="space-y-1 text-center">
                      {mainImagePreview ? (
                        <div className="relative">
                  <img 
                    src={mainImagePreview} 
                            alt="Property preview" 
                            className="mx-auto h-56 object-cover rounded-md shadow-sm" 
                  />
                          <button
                    type="button"
                    onClick={removeMainImage}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                  >
                    <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <svg
                            className="mx-auto h-16 w-16 text-[var(--portal-text-secondary)]"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                            <label
                              htmlFor="main-image-upload"
                              className="relative cursor-pointer bg-gold-500 hover:bg-gold-600 text-black font-medium rounded-md px-4 py-2 transition-colors focus-within:outline-none inline-flex items-center"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              <span>Upload main image</span>
                              <input
                                id="main-image-upload"
                                name="main-image-upload"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={handleMainImageChange}
                                required={!mainImage}
                              />
                            </label>
                            <p className="text-sm text-[var(--portal-text-secondary)]">or drag and drop</p>
                </div>
                          <p className="text-xs text-[var(--portal-text-secondary)] mt-2">
                            PNG, JPG, GIF up to 5MB
                          </p>
                        </>
              )}
                    </div>
                  </div>
            </div>
            
            <div>
                  <label className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                    Additional Images (Optional)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2">
                    {/* Render existing additional images */}
                {additionalImagePreviews.map((preview, index) => (
                      <div key={index} className="relative h-36 border rounded-lg overflow-hidden shadow-sm bg-[var(--portal-bg)]/40">
                    <img 
                      src={preview} 
                      alt={`Additional image ${index + 1}`} 
                          className="w-full h-full object-cover"
                    />
                        <button
                      type="button"
                      onClick={() => removeAdditionalImage(index)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                    >
                      <X className="h-3 w-3" />
                        </button>
                  </div>
                ))}
                
                    {/* Add more images button */}
                    {additionalImages.length < 5 && (
                      <label
                        htmlFor="additional-image-upload"
                        className="h-36 border-2 border-dashed border-[var(--portal-border)] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--portal-bg-hover)] transition-colors bg-[var(--portal-bg)]/40"
                      >
                        <Plus className="h-8 w-8 text-gold-500" />
                        <span className="text-sm text-[var(--portal-text-secondary)] mt-2 font-medium">Add Image</span>
                    <input 
                          id="additional-image-upload"
                      type="file" 
                      accept="image/*" 
                          className="sr-only"
                      onChange={handleAdditionalImagesChange}
                    />
                  </label>
                )}
              </div>
                  <p className="text-xs text-[var(--portal-text-secondary)] mt-3">
                    You can upload up to 5 additional images for better property presentation
                  </p>
            </div>
              </motion.div>
            )}

            {/* Contact Information Step */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label htmlFor="phone_number" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      Phone Number
                    </label>
                    <input
                      id="phone_number"
                      type="tel"
                      placeholder="e.g. +251 91 234 5678"
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                      {...form.register('phone_number')}
                      autoComplete="tel"
                    />
        </div>
        
        <div>
                    <label htmlFor="whatsapp_link" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      WhatsApp Link
                    </label>
                    <input
                      id="whatsapp_link"
                      type="text"
                      placeholder="e.g. https://wa.me/2519XXXXXXXX" 
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                      {...form.register('whatsapp_link')}
                      autoComplete="off"
                />
              </div>
              
              <div>
                    <label htmlFor="telegram_link" className="block text-sm font-medium text-[var(--portal-label-text)] mb-2">
                      Telegram Link
                    </label>
                    <input
                      id="telegram_link"
                      type="text"
                            placeholder="e.g. https://t.me/username" 
                      className="w-full px-4 py-3 rounded-lg bg-[var(--portal-input-bg)] text-[var(--portal-input-text)] border border-[var(--portal-input-border)] focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
                      {...form.register('telegram_link')}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </motion.div>
            )}
              </div>
              
          <div className="mt-12 pt-6 border-t border-[var(--portal-border)] flex justify-between items-center">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="border-[var(--portal-border)] text-[var(--portal-text-secondary)] hover:bg-[var(--portal-bg-hover)]"
              >
                Back
              </Button>
            )}

            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNextStep}
                className="ml-auto px-8 py-3 bg-gold-500 hover:bg-gold-600 text-black font-medium rounded-lg"
              >
                Continue
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isSubmitting}
                onClick={() => setSubmitAttempted(true)}
                className="ml-auto px-8 py-3 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-700 hover:to-gold-600 active:from-gold-800 active:to-gold-700 text-black font-medium rounded-lg shadow-md transition-all flex items-center justify-center text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating Listing...
                  </>
                ) : (
                  <>Create Listing</>
                )}
              </Button>
            )}
          </div>
            </form>
      </div>
      <AnimatePresence>
        {showSuccessPopup && (
          <Dialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
            <DialogContent>
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.35, type: 'spring', bounce: 0.4 }}
                style={{ position: 'relative', overflow: 'visible' }}
              >
                <DialogHeader>
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1.1, rotate: 8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                    style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(90deg, #FFD700 60%, #FF69B4 100%)',
                      borderRadius: '50%',
                      width: 72,
                      height: 72,
                      boxShadow: '0 4px 24px 0 #FFD70055',
                      fontSize: 48,
                      color: '#fff',
                    }}>
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1.2, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.1 }}
                        style={{ display: 'inline-block' }}
                      >
                        🎉
                      </motion.span>
                    </span>
                  </motion.div>
                  <DialogTitle style={{ textAlign: 'center', fontSize: 28, color: '#FFD700', fontWeight: 700 }}>
                    Congratulations!
                  </DialogTitle>
                </DialogHeader>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  style={{ textAlign: 'center', fontSize: 18, color: '#fff', margin: '16px 0 24px 0' }}
                >
                  Your listing is live and ready to shine!<br />Share it with the world or view it now.
                </motion.p>
                <DialogFooter style={{ justifyContent: 'center', gap: 16 }}>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.96 }}
                    className="bg-gold-500 hover:bg-gold-600 text-black font-semibold rounded-lg px-6 py-2 text-lg shadow-md transition"
                    onClick={() => window.location.href = publicListingUrl}
                  >
                    View Listing
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.96 }}
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-6 py-2 text-lg transition"
                    onClick={() => { setShowSuccessPopup(false); onSuccess(); }}
                  >
                    Close
                  </motion.button>
                </DialogFooter>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
};

export default CreateListingForm;
