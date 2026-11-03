'use client';

import { PhoneIcon } from 'lucide-react';
import { useId } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { useWebHaptics } from 'web-haptics/react';

import {
  IntroItem,
  IntroItemContent,
  IntroItemIcon,
  IntroItemLink,
} from '@/components/app/intro-item';
import { CopyButton } from '@/components/ncdai/copy-button';
import { DrawUnderline } from '@/components/ui/draw-underline';
import { useIsClient } from '@/hooks/use-is-client';
import { copyText } from '@/utils/copy';
import { decodePhoneNumber } from '@/utils/string';

import { RevealEncodedText } from './reveal-encoded-text';

type PhoneItemProps = {
  phoneNumber: string;
  /** Base64 of the display-formatted number, formatted on the server to keep libphonenumber out of the client bundle. */
  formattedPhoneNumber: string;
};

export function PhoneItem({
  phoneNumber,
  formattedPhoneNumber,
}: PhoneItemProps) {
  const id = useId();
  const isClient = useIsClient();
  const phoneNumberDecoded = decodePhoneNumber(phoneNumber);
  const phoneNumberFormatted = decodePhoneNumber(formattedPhoneNumber);

  useHotkeys('shift+p', () => {
    void copyText(phoneNumberDecoded).then((success) => {
      if (success) {
        toast.success('Phone number copied to clipboard');
      } else {
        toast.error('Failed to copy phone number');
      }
    });
  });

  const { trigger } = useWebHaptics({ debug: true });

  return (
    <IntroItem className="group">
      <IntroItemIcon>
        <PhoneIcon />
      </IntroItemIcon>

      <IntroItemContent>
        <IntroItemLink
          id={`phone-${id}`}
          href={isClient ? `tel:${phoneNumberDecoded}` : '#'}
          aria-label={
            isClient ? `Call ${phoneNumberFormatted}` : 'Phone number'
          }
          suppressHydrationWarning
        >
          <DrawUnderline>
            <span id={`phone-text-${id}`} suppressHydrationWarning>
              {isClient ? phoneNumberFormatted : '[Phone protected]'}
            </span>
          </DrawUnderline>
        </IntroItemLink>
      </IntroItemContent>

      <div className="ease-out-cubic -translate-x-3 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton
          className="text-muted-foreground bg-transparent"
          variant="ghost"
          size="icon-xs"
          text={phoneNumberDecoded}
          onCopySuccess={() => {
            trigger('success');
          }}
        />
      </div>

      <RevealEncodedText id={`phone-text-${id}`} text={formattedPhoneNumber} />
    </IntroItem>
  );
}
